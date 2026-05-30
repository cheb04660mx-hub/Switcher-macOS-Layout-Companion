# -*- coding: utf-8 -*-
"""
Switcher Companion — аналог Punto Switcher для macOS
Автоматическое переключение раскладки клавиатуры

Возможности:
- Автоопределение неправильной раскладки (Punto Switcher mode)
- Ручное переключение по горячей клавише (Alt+C)
- Текстовые сниппеты
- Определение и переключение раскладки через Carbon TIS API
"""
APP_VERSION = "1.1.0"

import sys
import os
import time
import threading
import subprocess
import re
import logging
import ctypes

try:
    from pynput import keyboard
    from pynput.keyboard import Key, Controller
except ImportError:
    print("Ошибка: библиотека 'pynput' не установлена. Установите: pip install pynput")
    sys.exit(1)

# ─── Logging ──────────────────────────────────────────────────────────────────
log_file = os.path.expanduser('~/.switcher_companion.log')
logging.basicConfig(
    filename=log_file,
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('switcher')
logger.info(f'Switcher Companion v{APP_VERSION} запущен')

# ─── Globals ──────────────────────────────────────────────────────────────────
keyboard_controller = Controller()
current_buffer = []
_suppressing = False  # Prevents self-listening during key simulation

# Modifier state tracking
is_cmd_pressed = False
is_alt_pressed = False
is_ctrl_pressed = False
is_shift_pressed = False

# ─── Configuration ────────────────────────────────────────────────────────────
MIN_AUTO_SWITCH_LENGTH = 3   # Minimum word length for auto-switching
AUTO_SWITCH = True            # Enable Punto Switcher auto-correction mode
HOTKEY_MODIFIER = "alt"       # Modifier for manual switch: alt, cmd, ctrl
HOTKEY_KEY = "c"              # Key for manual switch


# ═══════════════════════════════════════════════════════════════════════════════
# macOS Carbon TIS API — reliable keyboard layout detection & switching
# ═══════════════════════════════════════════════════════════════════════════════

_carbon = None
_cf = None
_kTISPropertyInputSourceID = None
_tis_available = False

LAYOUT_IDS = {
    'en': b'com.apple.keylayout.ABC',
    'ru': b'com.apple.keylayout.RussianWin',
    'ua': b'com.apple.keylayout.Ukrainian-PC',
}
LAYOUT_ID_TO_LANG = {v: k for k, v in LAYOUT_IDS.items()}


def _init_carbon_api():
    """Initialize Carbon TIS API for layout detection/switching."""
    global _carbon, _cf, _kTISPropertyInputSourceID, _tis_available
    try:
        _carbon = ctypes.cdll.LoadLibrary(
            '/System/Library/Frameworks/Carbon.framework/Carbon')
        _cf = ctypes.cdll.LoadLibrary(
            '/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')

        _carbon.TISCopyCurrentKeyboardInputSource.restype = ctypes.c_void_p

        _carbon.TISGetInputSourceProperty.restype = ctypes.c_void_p
        _carbon.TISGetInputSourceProperty.argtypes = [
            ctypes.c_void_p, ctypes.c_void_p]

        _carbon.TISCreateInputSourceList.restype = ctypes.c_void_p
        _carbon.TISCreateInputSourceList.argtypes = [
            ctypes.c_void_p, ctypes.c_bool]

        _carbon.TISSelectInputSource.restype = ctypes.c_int32
        _carbon.TISSelectInputSource.argtypes = [ctypes.c_void_p]

        _cf.CFStringGetCStringPtr.restype = ctypes.c_char_p
        _cf.CFStringGetCStringPtr.argtypes = [ctypes.c_void_p, ctypes.c_uint32]

        _cf.CFArrayGetCount.restype = ctypes.c_long
        _cf.CFArrayGetCount.argtypes = [ctypes.c_void_p]

        _cf.CFArrayGetValueAtIndex.restype = ctypes.c_void_p
        _cf.CFArrayGetValueAtIndex.argtypes = [ctypes.c_void_p, ctypes.c_long]

        _cf.CFRelease.argtypes = [ctypes.c_void_p]

        _kTISPropertyInputSourceID = ctypes.c_void_p.in_dll(
            _carbon, 'kTISPropertyInputSourceID')

        _tis_available = True
        logger.info("Carbon TIS API инициализирован успешно")
    except Exception as e:
        logger.error(f"Ошибка инициализации Carbon TIS API: {e}")
        _tis_available = False


_init_carbon_api()


def get_current_layout():
    """Get the currently active keyboard layout.

    Returns:
        'en', 'ru', 'ua', or 'unknown'
    """
    if not _tis_available:
        return 'unknown'
    try:
        source = _carbon.TISCopyCurrentKeyboardInputSource()
        if not source:
            return 'unknown'
        prop = _carbon.TISGetInputSourceProperty(
            source, _kTISPropertyInputSourceID)
        if prop:
            name = _cf.CFStringGetCStringPtr(prop, 0)
            if name:
                lang = LAYOUT_ID_TO_LANG.get(name, 'unknown')
                _cf.CFRelease(source)
                return lang
        _cf.CFRelease(source)
    except Exception as e:
        logger.error(f"Ошибка определения раскладки: {e}")
    return 'unknown'


def switch_to_layout(target_lang):
    """Switch macOS keyboard layout to a specific language.

    Args:
        target_lang: 'en', 'ru', or 'ua'

    Returns:
        True if switch was successful
    """
    target_id = LAYOUT_IDS.get(target_lang)
    if not target_id or not _tis_available:
        return False
    try:
        sources = _carbon.TISCreateInputSourceList(None, False)
        if not sources:
            return False
        count = _cf.CFArrayGetCount(sources)
        found = False
        for i in range(count):
            source = _cf.CFArrayGetValueAtIndex(sources, i)
            prop = _carbon.TISGetInputSourceProperty(
                source, _kTISPropertyInputSourceID)
            if prop:
                name = _cf.CFStringGetCStringPtr(prop, 0)
                if name == target_id:
                    result = _carbon.TISSelectInputSource(source)
                    found = (result == 0)
                    break
        _cf.CFRelease(sources)
        if found:
            logger.info(f"Раскладка переключена → {target_lang}")
        return found
    except Exception as e:
        logger.error(f"Ошибка переключения раскладки: {e}")
    return False


# ═══════════════════════════════════════════════════════════════════════════════
# Hardware Key Code Map & Layout Conversion
# ═══════════════════════════════════════════════════════════════════════════════

# macOS Virtual Key Code → English letter (standard QWERTY)
MACOS_VK_MAP = {
    0: 'a', 1: 's', 2: 'd', 3: 'f', 4: 'h', 5: 'g', 6: 'z', 7: 'x',
    8: 'c', 9: 'v', 11: 'b', 12: 'q', 13: 'w', 14: 'e', 15: 'r',
    16: 'y', 17: 't', 18: '1', 19: '2', 20: '3', 21: '4', 22: '6',
    23: '5', 24: '=', 25: '9', 26: '7', 27: '-', 28: '8', 29: '0',
    30: ']', 31: 'o', 32: 'u', 33: '[', 34: 'i', 35: 'p', 37: 'l',
    38: 'j', 39: "'", 40: 'k', 41: ';', 42: '\\', 43: ',', 44: '/',
    45: 'n', 46: 'm', 47: '.', 50: '`'
}

# Custom text snippets
SNIPPETS = {
    ';дд': 'Добрый день!',
    ';дп': 'Дякую за допомогу!',
    ';сл': 'Слава Україні! Героям слава!',
    ';em': 'achebanmx@gmail.com',
    ';ty': 'Thank you so much!',
    ';sh': '¯\\_(ツ)_/¯'
}

# Bidirectional layout character arrays
EN_KEYS = "qwertyuiop[]asdfghjkl;'zxcvbnm,./QWERTYUIOP{}ASDFGHJKL:\"ZXCVBNM<>?`~"
RU_KEYS = "йцукенгшщзхъфывапролджэячсмитьбю.ЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮ,ёЁ"
UA_KEYS = "йцукенгшщзхїфівапролджєячсмитьбю.ЙЦУКЕНГШЩЗХЇФІВАПРОЛДЖЄЯЧСМИТЬБЮ,іІ"

en_to_ru = {EN_KEYS[i]: RU_KEYS[i] for i in range(min(len(EN_KEYS), len(RU_KEYS)))}
ru_to_en = {RU_KEYS[i]: EN_KEYS[i] for i in range(min(len(EN_KEYS), len(RU_KEYS)))}
en_to_ua = {EN_KEYS[i]: UA_KEYS[i] for i in range(min(len(EN_KEYS), len(UA_KEYS)))}
ua_to_en = {UA_KEYS[i]: EN_KEYS[i] for i in range(min(len(EN_KEYS), len(UA_KEYS)))}


# ═══════════════════════════════════════════════════════════════════════════════
# Dictionaries for Layout Detection
# ═══════════════════════════════════════════════════════════════════════════════

EN_DICTIONARY = {
    'the', 'be', 'to', 'of', 'and', 'in', 'that', 'have', 'it', 'for',
    'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but',
    'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an',
    'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so',
    'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
    'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
    'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could',
    'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only',
    'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use',
    'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new',
    'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
    'is', 'are', 'was', 'were', 'been', 'has', 'had', 'hello', 'hi',
    'hey', 'test', 'please', 'thanks', 'thank', 'layout', 'switcher',
    'mac', 'macos', 'app', 'application', 'file', 'folder', 'script',
    'code', 'run', 'setup', 'help', 'setting', 'options', 'keyboard',
    'typing', 'text', 'word', 'phrase', 'conversion', 'auto', 'manual',
    'active', 'sound', 'notification', 'yes'
}

RU_DICTIONARY = {
    'и', 'в', 'во', 'не', 'на', 'что', 'я', 'с', 'со', 'он', 'а',
    'как', 'то', 'это', 'но', 'по', 'к', 'ко', 'из', 'у', 'его', 'за',
    'вы', 'бы', 'же', 'было', 'мой', 'все', 'она', 'так', 'да', 'о',
    'об', 'ты', 'от', 'ото', 'один', 'мне', 'еще', 'быть', 'только',
    'до', 'себя', 'свое', 'какой', 'когда', 'уже', 'был', 'кто',
    'него', 'всех', 'вас', 'под', 'подо', 'прямо', 'слово', 'раз',
    'если', 'время', 'может', 'были', 'тут', 'сказал', 'чем', 'была',
    'глаз', 'ней', 'рука', 'друг', 'день', 'чей', 'наш', 'ваш',
    'привет', 'дела', 'работа', 'спасибо', 'пожалуйста', 'тест',
    'программа', 'раскладка', 'клавиатура', 'автопереключение', 'звук',
    'фраза', 'быстро', 'верно', 'нет', 'добрый', 'утро', 'вечер',
    'ночь', 'хорошо', 'отлично', 'новый', 'сделать', 'написать', 'код',
    'скрипт', 'настройки', 'помощь', 'описание', 'автозамена', 'шаблон',
    'язык', 'русский', 'украинский', 'английский', 'компьютер',
    'система', 'активный', 'версия', 'проверка', 'пример', 'вечера',
    'вечером', 'делами', 'новинка', 'новые', 'нового', 'новому',
    'очень', 'хороший', 'приветствие', 'приветствовать', 'украина',
    'украины', 'россия', 'россии'
}

UA_DICTIONARY = {
    'і', 'та', 'в', 'у', 'не', 'на', 'що', 'я', 'з', 'зі', 'він',
    'а', 'як', 'це', 'но', 'по', 'до', 'від', 'уже', 'вже', 'його',
    'за', 'ви', 'би', 'же', 'було', 'мій', 'все', 'вона', 'так',
    'також', 'й', 'один', 'мені', 'ще', 'бути', 'тільки', 'себе',
    'своє', 'який', 'яка', 'яке', 'які', 'яких', 'яким', 'якими',
    'коли', 'всі', 'вас', 'під', 'підо', 'прямо', 'слово', 'раз',
    'якщо', 'час', 'може', 'були', 'тут', 'сказав', 'ніж', 'була',
    'око', 'рука', 'друг', 'день', 'наш', 'ваш', 'привіт', 'дякую',
    'будь-ласка', 'добре', 'чудово', 'ні', 'ласка', 'тест', 'програма',
    'розкладка', 'клавіатура', 'автопереключення', 'звук', 'фраза',
    'швидко', 'правильно', 'ранок', 'вечір', 'ніч', 'новий', 'нові',
    'нового', 'справи', 'справа', 'справ', 'зробити', 'написати',
    'код', 'скрипт', 'налаштування', 'допомога', 'опис', 'автозаміна',
    'шаблон', 'мова', 'українська', 'російська', 'англійська', 'система',
    'активний', 'версія', 'україна', 'інтернет', 'світ', 'рік',
    'життя', 'людина', 'країна', 'єдиний', 'їжа', 'нових', 'новому',
    'тобі', 'вечора', 'вечором', 'ми', 'вони', 'україни', 'українську',
    'український', 'українські', 'українською', 'українського'
}


# ═══════════════════════════════════════════════════════════════════════════════
# Heuristic Functions
# ═══════════════════════════════════════════════════════════════════════════════

def is_impossible_in_english(word):
    """Check if a word contains letter combinations impossible in English."""
    w = word.lower()
    if len(w) < 2:
        return False
    bad_starts = [
        "nt", "rt", "dt", "yt", "gt", "ht", "jt", "kt", "lt", "vt", "ct",
        "mt", "zb", "xd", "cb", "vb", "bb", "nb", "zf", "zg", "zk", "zm",
        "zn", "zp", "zs", "zv", "zw", "zx", "qy", "vj", "xj", "zj", "qc",
        "qk", "qv", "qw", "gx", "hx", "mx", "px", "rx", "wx"
    ]
    for prefix in bad_starts:
        if w.startswith(prefix):
            return True
    if w.startswith("q") and len(w) > 1 and w[1] not in "uaioe":
        return True
    if any(double in w for double in ["vv", "yy", "jj", "xx", "qq"]):
        return True
    return False


def is_impossible_in_cyrillic(word):
    """Check if a word contains letter combinations impossible in Cyrillic."""
    w = word.lower()
    if len(w) < 1:
        return False
    if w[0] in ("ь", "ъ", "ы"):
        return True
    if len(w) < 2:
        return False
    if any(double in w for double in [
        "ьь", "ъъ", "ыы", "ъь", "ьъ", "йы", "йь", "йъ"
    ]):
        return True
    bad_starts = ["щй", "чй", "цй", "фй", "хй", "йй"]
    for prefix in bad_starts:
        if w.startswith(prefix):
            return True
    return False


# ═══════════════════════════════════════════════════════════════════════════════
# Conversion Functions
# ═══════════════════════════════════════════════════════════════════════════════

def convert_pt_char(char, from_lang, to_lang):
    """Convert a single character between keyboard layouts."""
    if from_lang == to_lang:
        return char
    if from_lang == "en":
        if to_lang == "ru":
            return en_to_ru.get(char, char)
        if to_lang == "ua":
            return en_to_ua.get(char, char)
    elif from_lang == "ru":
        if to_lang == "en":
            return ru_to_en.get(char, char)
        if to_lang == "ua":
            diffs = {
                "ы": "і", "Ы": "І", "э": "є", "Э": "Є",
                "ъ": "ї", "Ъ": "Ї", "ё": "'", "Ё": "Ґ"
            }
            if char in diffs:
                return diffs[char]
            en_char = ru_to_en.get(char)
            return en_to_ua.get(en_char, char) if en_char else char
    elif from_lang == "ua":
        if to_lang == "en":
            return ua_to_en.get(char, char)
        if to_lang == "ru":
            diffs = {
                "і": "ы", "І": "Ы", "є": "э", "Є": "Э",
                "ї": "ъ", "Ї": "Ъ", "'": "ё", "Ґ": "Ё"
            }
            if char in diffs:
                return diffs[char]
            en_char = ua_to_en.get(char)
            return en_to_ru.get(en_char, char) if en_char else char
    return char


def convert_pt_word(text, from_lang, to_lang):
    """Convert a word/text between keyboard layouts."""
    return "".join(convert_pt_char(c, from_lang, to_lang) for c in text)


# ═══════════════════════════════════════════════════════════════════════════════
# Layout Anomaly Detection (Improved Punto Switcher Logic)
# ═══════════════════════════════════════════════════════════════════════════════

def detect_layout_anomaly(word, current_layout):
    """Detect if a word was typed in the wrong keyboard layout.

    Uses the current system layout for accurate detection:
    - If layout is EN and text is Latin → check if it should be RU/UA
    - If layout is RU/UA and text is Cyrillic → check if it should be EN
    - If the word IS valid in the current layout → never switch (prevents false positives)

    Args:
        word: The typed word to check
        current_layout: Current keyboard layout ('en', 'ru', 'ua', 'unknown')

    Returns:
        dict: {switchNeeded: bool, targetLang: str, converted: str}
    """
    if not word or len(word) < MIN_AUTO_SWITCH_LENGTH:
        return {
            "switchNeeded": False,
            "targetLang": current_layout or "en",
            "converted": word
        }

    has_cyrillic = bool(re.search(r'[а-яА-ЯёЁіІєЄїЇґҐ]', word))
    has_latin = bool(re.search(r'[a-zA-Z]', word))

    # ── Case 1: English layout active, Latin characters typed ──
    # User may have forgotten to switch to Cyrillic
    if current_layout == 'en' and has_latin and not has_cyrillic:
        word_lower = word.lower()

        # If the word IS a valid English word → never switch
        if word_lower in EN_DICTIONARY:
            return {
                "switchNeeded": False,
                "targetLang": "en",
                "converted": word
            }

        converted_ru = convert_pt_word(word, "en", "ru")
        converted_ua = convert_pt_word(word, "en", "ua")

        # Strong signal: converted word exists in the dictionary
        if converted_ru.lower() in RU_DICTIONARY:
            return {
                "switchNeeded": True,
                "targetLang": "ru",
                "converted": converted_ru
            }
        if converted_ua.lower() in UA_DICTIONARY:
            return {
                "switchNeeded": True,
                "targetLang": "ua",
                "converted": converted_ua
            }

        # Medium signal: impossible English letter combination
        if is_impossible_in_english(word):
            if not is_impossible_in_cyrillic(converted_ru):
                return {
                    "switchNeeded": True,
                    "targetLang": "ru",
                    "converted": converted_ru
                }
            if not is_impossible_in_cyrillic(converted_ua):
                return {
                    "switchNeeded": True,
                    "targetLang": "ua",
                    "converted": converted_ua
                }

    # ── Case 2: Russian layout active, Cyrillic characters typed ──
    # User may have forgotten to switch to English
    elif current_layout == 'ru' and has_cyrillic and not has_latin:
        word_lower = word.lower()

        # If the word IS a valid Russian word → never switch
        if word_lower in RU_DICTIONARY:
            return {
                "switchNeeded": False,
                "targetLang": "ru",
                "converted": word
            }

        converted_en = convert_pt_word(word, "ru", "en")

        if converted_en.lower() in EN_DICTIONARY:
            return {
                "switchNeeded": True,
                "targetLang": "en",
                "converted": converted_en
            }

        if (is_impossible_in_cyrillic(word)
                and not is_impossible_in_english(converted_en)):
            return {
                "switchNeeded": True,
                "targetLang": "en",
                "converted": converted_en
            }

    # ── Case 3: Ukrainian layout active, Cyrillic characters typed ──
    elif current_layout == 'ua' and has_cyrillic and not has_latin:
        word_lower = word.lower()

        if word_lower in UA_DICTIONARY:
            return {
                "switchNeeded": False,
                "targetLang": "ua",
                "converted": word
            }

        converted_en = convert_pt_word(word, "ua", "en")

        if converted_en.lower() in EN_DICTIONARY:
            return {
                "switchNeeded": True,
                "targetLang": "en",
                "converted": converted_en
            }

        if (is_impossible_in_cyrillic(word)
                and not is_impossible_in_english(converted_en)):
            return {
                "switchNeeded": True,
                "targetLang": "en",
                "converted": converted_en
            }

    # ── Case 4: Unknown layout or mixed script → don't switch ──
    return {
        "switchNeeded": False,
        "targetLang": current_layout or "en",
        "converted": word
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Clipboard & Keystroke Helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _get_clipboard():
    """Get current clipboard content."""
    try:
        return subprocess.check_output(
            ['pbpaste'], text=True, errors='ignore')
    except Exception:
        return ""


def _set_clipboard(text):
    """Set clipboard content."""
    p = subprocess.Popen(['pbcopy'], stdin=subprocess.PIPE, text=True)
    p.communicate(text)


def _simulate_paste():
    """Simulate Cmd+V."""
    keyboard_controller.press(Key.cmd)
    keyboard_controller.press('v')
    keyboard_controller.release('v')
    keyboard_controller.release(Key.cmd)


def _simulate_copy():
    """Simulate Cmd+C."""
    keyboard_controller.press(Key.cmd)
    keyboard_controller.press('c')
    keyboard_controller.release('c')
    keyboard_controller.release(Key.cmd)


def _simulate_backspace(count):
    """Simulate N backspace presses."""
    for _ in range(count):
        keyboard_controller.press(Key.backspace)
        keyboard_controller.release(Key.backspace)
        time.sleep(0.005)


def _release_all_modifiers():
    """Release all modifier keys to prevent stuck modifiers."""
    keyboard_controller.release(Key.cmd)
    keyboard_controller.release(Key.alt)
    keyboard_controller.release(Key.ctrl)
    keyboard_controller.release(Key.shift)
    time.sleep(0.02)


# ═══════════════════════════════════════════════════════════════════════════════
# Selected Text Helper
# ═══════════════════════════════════════════════════════════════════════════════

def get_selected_text():
    """Get currently selected text via Cmd+C clipboard simulation."""
    _release_all_modifiers()

    old_clipboard = _get_clipboard()
    _set_clipboard('')

    _simulate_copy()
    time.sleep(0.08)

    selected = _get_clipboard()
    _set_clipboard(old_clipboard)

    if selected and len(selected) > 0:
        return selected
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# Forced Conversion (Manual Hotkey: Alt+C)
# ═══════════════════════════════════════════════════════════════════════════════

def trigger_forced_conversion():
    """Manual layout conversion triggered by the hotkey.

    Tries selected text first, then falls back to typed word buffer.
    Determines conversion direction from the current layout.
    """
    global current_buffer, _suppressing

    _suppressing = True
    try:
        current_layout = get_current_layout()
        _release_all_modifiers()

        # ── Try selected text first ──
        selected = get_selected_text()
        if selected:
            has_cyrillic = bool(
                re.search(r'[а-яА-ЯёЁіІєЄїЇґҐ]', selected))

            if has_cyrillic:
                from_lang = (current_layout
                             if current_layout in ('ru', 'ua') else 'ru')
                converted = convert_pt_word(selected, from_lang, "en")
                target_lang = "en"
            else:
                converted = convert_pt_word(selected, "en", "ru")
                target_lang = "ru"

            if converted != selected:
                _set_clipboard(converted)
                _simulate_paste()
                time.sleep(0.08)
                switch_to_layout(target_lang)
                logger.info(
                    f"Принудительная конвертация (выделение): "
                    f"'{selected[:30]}' → '{converted[:30]}' [{target_lang}]")
                time.sleep(0.1)
                return

        # ── Fallback: typed word buffer ──
        if current_buffer:
            word = "".join(current_buffer)
            has_cyrillic = bool(
                re.search(r'[а-яА-ЯёЁіІєЄїЇґҐ]', word))

            if has_cyrillic:
                from_lang = (current_layout
                             if current_layout in ('ru', 'ua') else 'ru')
                converted = convert_pt_word(word, from_lang, "en")
                target_lang = "en"
            else:
                converted = convert_pt_word(word, "en", "ru")
                target_lang = "ru"

            if converted != word:
                old_clipboard = _get_clipboard()

                _simulate_backspace(len(word))
                time.sleep(0.05)

                _set_clipboard(converted)
                _simulate_paste()
                time.sleep(0.08)

                _set_clipboard(old_clipboard)
                switch_to_layout(target_lang)
                current_buffer = []

                logger.info(
                    f"Принудительная конвертация (буфер): "
                    f"'{word}' → '{converted}' [{target_lang}]")

        time.sleep(0.1)
    finally:
        _suppressing = False


# ═══════════════════════════════════════════════════════════════════════════════
# Auto-Correction (Punto Switcher Mode)
# ═══════════════════════════════════════════════════════════════════════════════

def _auto_correct_word(word, trigger_key):
    """Auto-correct a word typed in the wrong layout.

    Runs in a background thread after user presses Space or Enter.

    Args:
        word: The typed word to check
        trigger_key: 'space' or 'enter'
    """
    global _suppressing

    # Small delay to let the trigger key event be delivered to the app
    time.sleep(0.03)

    # Race condition guard: if user already started typing next word, abort
    if current_buffer:
        return

    current_layout = get_current_layout()
    anomaly = detect_layout_anomaly(word, current_layout)

    if not anomaly["switchNeeded"]:
        return

    # Double-check race condition before modifying text
    if current_buffer:
        return

    converted = anomaly["converted"]
    target_lang = anomaly["targetLang"]

    _suppressing = True
    try:
        logger.info(
            f"Автокоррекция: '{word}' → '{converted}' "
            f"(раскладка: {current_layout} → {target_lang})")

        # Calculate chars to delete: word + trigger character (space/enter)
        if trigger_key == 'space':
            delete_count = len(word) + 1
            paste_str = converted + ' '
        elif trigger_key == 'enter':
            delete_count = len(word) + 1
            paste_str = converted + '\n'
        else:
            delete_count = len(word)
            paste_str = converted

        old_clipboard = _get_clipboard()

        _simulate_backspace(delete_count)
        time.sleep(0.05)

        _set_clipboard(paste_str)
        _simulate_paste()
        time.sleep(0.08)

        _set_clipboard(old_clipboard)
        switch_to_layout(target_lang)

        time.sleep(0.1)
    finally:
        _suppressing = False


def _expand_snippet(word):
    """Expand a text snippet. Runs in a background thread.

    Args:
        word: The snippet trigger text (e.g. ';дд')
    """
    global _suppressing

    if word not in SNIPPETS:
        return

    replacement = SNIPPETS[word]

    # Small delay to let the trigger key be delivered
    time.sleep(0.03)

    _suppressing = True
    try:
        logger.info(f"Сниппет: '{word}' → '{replacement}'")

        # Delete trigger + the space/enter that triggered it
        _simulate_backspace(len(word) + 1)
        time.sleep(0.03)

        old_clipboard = _get_clipboard()
        # Paste replacement + space (since the trigger was a word boundary)
        _set_clipboard(replacement + ' ')
        _simulate_paste()
        time.sleep(0.08)

        _set_clipboard(old_clipboard)

        time.sleep(0.1)
    finally:
        _suppressing = False


# ═══════════════════════════════════════════════════════════════════════════════
# Key Event Handlers
# ═══════════════════════════════════════════════════════════════════════════════

def check_modifiers(key, press_state):
    """Track modifier key state."""
    global is_cmd_pressed, is_alt_pressed, is_ctrl_pressed, is_shift_pressed
    if key in (Key.cmd, Key.cmd_l, Key.cmd_r):
        is_cmd_pressed = press_state
    elif key in (Key.alt, Key.alt_l, Key.alt_r):
        is_alt_pressed = press_state
    elif key in (Key.ctrl, Key.ctrl_l, Key.ctrl_r):
        is_ctrl_pressed = press_state
    elif key in (Key.shift, Key.shift_l, Key.shift_r):
        is_shift_pressed = press_state


def on_press(key):
    """Handle key press events."""
    global current_buffer

    # ── Suppress self-generated key events ──
    if _suppressing:
        return

    try:
        logger.debug(
            f"Клавиша: {key} "
            f"(vk: {getattr(key, 'vk', None)}, "
            f"char: {getattr(key, 'char', None)})")

        check_modifiers(key, True)

        # ── Hotkey Detection ──
        is_modifier_active = False
        if HOTKEY_MODIFIER == "alt" and is_alt_pressed:
            is_modifier_active = True
        elif HOTKEY_MODIFIER == "cmd" and is_cmd_pressed:
            is_modifier_active = True
        elif HOTKEY_MODIFIER == "ctrl" and is_ctrl_pressed:
            is_modifier_active = True

        if is_modifier_active:
            hotkey_key = HOTKEY_KEY.lower()
            triggered = False

            # Check via hardware keycode (layout-independent)
            vk = getattr(key, 'vk', None)
            pressed_char = None
            if vk in MACOS_VK_MAP:
                pressed_char = MACOS_VK_MAP[vk]
            elif hasattr(key, 'char') and key.char is not None:
                pressed_char = key.char.lower()

            if hotkey_key == "space" and (key == Key.space or vk == 49):
                triggered = True
            elif hotkey_key == "tab" and key == Key.tab:
                triggered = True
            elif pressed_char == hotkey_key:
                triggered = True

            if triggered:
                logger.info(
                    f"Горячая клавиша! Буфер: {len(current_buffer)} символов")
                threading.Thread(
                    target=trigger_forced_conversion, daemon=True).start()
                return

        # ── Backspace → remove last char from buffer ──
        if key == Key.backspace:
            if current_buffer:
                current_buffer.pop()
            return

        # ── Word boundary keys → trigger correction/snippet ──
        if key in (Key.space, Key.enter, Key.esc, Key.left, Key.right,
                   Key.up, Key.down, Key.home, Key.end, Key.page_up,
                   Key.page_down, Key.tab):
            if current_buffer:
                word = "".join(current_buffer)
                current_buffer = []

                # Only expand snippets / auto-correct on Space or Enter
                if key in (Key.space, Key.enter):
                    trigger = ('space' if key == Key.space else 'enter')

                    # Snippets have priority over auto-correction
                    if word in SNIPPETS:
                        threading.Thread(
                            target=_expand_snippet,
                            args=(word,),
                            daemon=True).start()
                        return

                    # Punto Switcher auto-correction
                    if AUTO_SWITCH:
                        threading.Thread(
                            target=_auto_correct_word,
                            args=(word, trigger),
                            daemon=True).start()
            else:
                current_buffer = []
            return

        # ── Skip recording if shortcut modifiers pressed (except Shift) ──
        if is_cmd_pressed or is_ctrl_pressed or is_alt_pressed:
            return

        # ── Record typed character to buffer ──
        char = None
        if hasattr(key, 'char') and key.char is not None:
            char = key.char
        else:
            vk = getattr(key, 'vk', None)
            if vk in MACOS_VK_MAP:
                char = MACOS_VK_MAP[vk]

        if char is not None and not char.isspace():
            current_buffer.append(char)

    except Exception as e:
        logger.error(f"Ошибка обработки клавиши: {e}")


def on_release(key):
    """Handle key release events.

    Always updates modifier state, even when suppressing,
    to prevent stuck modifier keys.
    """
    try:
        check_modifiers(key, False)
    except Exception:
        pass


# ═══════════════════════════════════════════════════════════════════════════════
# Accessibility Check
# ═══════════════════════════════════════════════════════════════════════════════

def check_accessibility():
    """Check if the app has Accessibility permissions on macOS."""
    lib = None
    for path in [
        'ApplicationServices',
        '/System/Library/Frameworks/ApplicationServices.framework/'
        'Versions/A/ApplicationServices',
        '/System/Library/Frameworks/ApplicationServices.framework/'
        'Versions/Current/ApplicationServices',
        '/System/Library/Frameworks/ApplicationServices.framework/'
        'ApplicationServices'
    ]:
        try:
            lib = ctypes.CDLL(path)
            if hasattr(lib, 'AXIsProcessTrusted'):
                break
        except Exception:
            continue

    if lib and hasattr(lib, 'AXIsProcessTrusted'):
        try:
            lib.AXIsProcessTrusted.restype = ctypes.c_bool
            return bool(lib.AXIsProcessTrusted())
        except Exception:
            pass
    return False


# ═══════════════════════════════════════════════════════════════════════════════
# Startup
# ═══════════════════════════════════════════════════════════════════════════════

is_trusted = check_accessibility()
if not is_trusted:
    print("\n" + "=" * 60)
    print("❌ ОШИБКА: НЕТ ПРАВ ДОСТУПА!")
    print("Вашему терминалу (или IDE) нужны разрешения")
    print("для перехвата клавиатуры!")
    print("")
    print("Как исправить:")
    print("1. Системные настройки → Конфиденциальность и безопасность")
    print("2. 'Мониторинг ввода' (Input Monitoring)")
    print("   и/или 'Универсальный доступ' (Accessibility)")
    print("3. Включите галочку для вашего Терминала / Python / IDE")
    print("4. ПЕРЕЗАПУСТИТЕ программу после выдачи прав")
    print("=" * 60 + "\n")
    try:
        script = ('tell application "System Events" '
                  'to set UI_enabled to UI elements enabled')
        subprocess.run(
            ['osascript', '-e', script],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass
else:
    print("✅ Доступ к клавиатуре (Accessibility) подтвержден!")

current_layout = get_current_layout()
print(f"\n🍏 Switcher Companion v{APP_VERSION}")
print(f"   Аналог Punto Switcher для macOS\n")
print(f"📋 Текущая раскладка: {current_layout}")
print(f"⌨️  Горячая клавиша: {HOTKEY_MODIFIER.upper()}+{HOTKEY_KEY.upper()}")
print(f"🔄 Автопереключение: {'ВКЛ' if AUTO_SWITCH else 'ВЫКЛ'}"
      f" (мин. {MIN_AUTO_SWITCH_LENGTH} символа)")
print(f"📝 Сниппетов: {len(SNIPPETS)}")
print(f"\nФоновый мониторинг запущен. Ctrl+C для завершения.\n")

listener_instance = keyboard.Listener(
    on_press=on_press, on_release=on_release)
with listener_instance:
    listener_instance.join()
