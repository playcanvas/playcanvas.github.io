/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
const ACTION_MOUSE = 'mouse';
const ACTION_KEYBOARD = 'keyboard';
const ACTION_GAMEPAD = 'gamepad';
const AXIS_MOUSE_X = 'mousex';
const AXIS_MOUSE_Y = 'mousey';
const AXIS_PAD_L_X = 'padlx';
const AXIS_PAD_L_Y = 'padly';
const AXIS_PAD_R_X = 'padrx';
const AXIS_PAD_R_Y = 'padry';
const AXIS_KEY = 'key';
const EVENT_KEYDOWN = 'keydown';
const EVENT_KEYUP = 'keyup';
const EVENT_MOUSEDOWN = 'mousedown';
const EVENT_MOUSEMOVE = 'mousemove';
const EVENT_MOUSEUP = 'mouseup';
const EVENT_MOUSEWHEEL = 'mousewheel';
const EVENT_TOUCHSTART = 'touchstart';
const EVENT_TOUCHEND = 'touchend';
const EVENT_TOUCHMOVE = 'touchmove';
const EVENT_TOUCHCANCEL = 'touchcancel';
const EVENT_SELECT = 'select';
const EVENT_SELECTSTART = 'selectstart';
const EVENT_SELECTEND = 'selectend';
const KEY_BACKSPACE = 8;
const KEY_TAB = 9;
const KEY_RETURN = 13;
const KEY_ENTER = 13;
const KEY_SHIFT = 16;
const KEY_CONTROL = 17;
const KEY_ALT = 18;
const KEY_PAUSE = 19;
const KEY_CAPS_LOCK = 20;
const KEY_ESCAPE = 27;
const KEY_SPACE = 32;
const KEY_PAGE_UP = 33;
const KEY_PAGE_DOWN = 34;
const KEY_END = 35;
const KEY_HOME = 36;
const KEY_LEFT = 37;
const KEY_UP = 38;
const KEY_RIGHT = 39;
const KEY_DOWN = 40;
const KEY_PRINT_SCREEN = 44;
const KEY_INSERT = 45;
const KEY_DELETE = 46;
const KEY_0 = 48;
const KEY_1 = 49;
const KEY_2 = 50;
const KEY_3 = 51;
const KEY_4 = 52;
const KEY_5 = 53;
const KEY_6 = 54;
const KEY_7 = 55;
const KEY_8 = 56;
const KEY_9 = 57;
const KEY_SEMICOLON = 59;
const KEY_EQUAL = 61;
const KEY_A = 65;
const KEY_B = 66;
const KEY_C = 67;
const KEY_D = 68;
const KEY_E = 69;
const KEY_F = 70;
const KEY_G = 71;
const KEY_H = 72;
const KEY_I = 73;
const KEY_J = 74;
const KEY_K = 75;
const KEY_L = 76;
const KEY_M = 77;
const KEY_N = 78;
const KEY_O = 79;
const KEY_P = 80;
const KEY_Q = 81;
const KEY_R = 82;
const KEY_S = 83;
const KEY_T = 84;
const KEY_U = 85;
const KEY_V = 86;
const KEY_W = 87;
const KEY_X = 88;
const KEY_Y = 89;
const KEY_Z = 90;
const KEY_WINDOWS = 91;
const KEY_CONTEXT_MENU = 93;
const KEY_NUMPAD_0 = 96;
const KEY_NUMPAD_1 = 97;
const KEY_NUMPAD_2 = 98;
const KEY_NUMPAD_3 = 99;
const KEY_NUMPAD_4 = 100;
const KEY_NUMPAD_5 = 101;
const KEY_NUMPAD_6 = 102;
const KEY_NUMPAD_7 = 103;
const KEY_NUMPAD_8 = 104;
const KEY_NUMPAD_9 = 105;
const KEY_MULTIPLY = 106;
const KEY_ADD = 107;
const KEY_SEPARATOR = 108;
const KEY_SUBTRACT = 109;
const KEY_DECIMAL = 110;
const KEY_DIVIDE = 111;
const KEY_F1 = 112;
const KEY_F2 = 113;
const KEY_F3 = 114;
const KEY_F4 = 115;
const KEY_F5 = 116;
const KEY_F6 = 117;
const KEY_F7 = 118;
const KEY_F8 = 119;
const KEY_F9 = 120;
const KEY_F10 = 121;
const KEY_F11 = 122;
const KEY_F12 = 123;
const KEY_COMMA = 188;
const KEY_PERIOD = 190;
const KEY_SLASH = 191;
const KEY_OPEN_BRACKET = 219;
const KEY_BACK_SLASH = 220;
const KEY_CLOSE_BRACKET = 221;
const KEY_META = 224;
const MOUSEBUTTON_NONE = -1;
const MOUSEBUTTON_LEFT = 0;
const MOUSEBUTTON_MIDDLE = 1;
const MOUSEBUTTON_RIGHT = 2;
const PAD_1 = 0;
const PAD_2 = 1;
const PAD_3 = 2;
const PAD_4 = 3;
const PAD_FACE_1 = 0;
const PAD_FACE_2 = 1;
const PAD_FACE_3 = 2;
const PAD_FACE_4 = 3;
const PAD_L_SHOULDER_1 = 4;
const PAD_R_SHOULDER_1 = 5;
const PAD_L_SHOULDER_2 = 6;
const PAD_R_SHOULDER_2 = 7;
const PAD_SELECT = 8;
const PAD_START = 9;
const PAD_L_STICK_BUTTON = 10;
const PAD_R_STICK_BUTTON = 11;
const PAD_UP = 12;
const PAD_DOWN = 13;
const PAD_LEFT = 14;
const PAD_RIGHT = 15;
const PAD_VENDOR = 16;
const PAD_L_STICK_X = 0;
const PAD_L_STICK_Y = 1;
const PAD_R_STICK_X = 2;
const PAD_R_STICK_Y = 3;

export { ACTION_GAMEPAD, ACTION_KEYBOARD, ACTION_MOUSE, AXIS_KEY, AXIS_MOUSE_X, AXIS_MOUSE_Y, AXIS_PAD_L_X, AXIS_PAD_L_Y, AXIS_PAD_R_X, AXIS_PAD_R_Y, EVENT_KEYDOWN, EVENT_KEYUP, EVENT_MOUSEDOWN, EVENT_MOUSEMOVE, EVENT_MOUSEUP, EVENT_MOUSEWHEEL, EVENT_SELECT, EVENT_SELECTEND, EVENT_SELECTSTART, EVENT_TOUCHCANCEL, EVENT_TOUCHEND, EVENT_TOUCHMOVE, EVENT_TOUCHSTART, KEY_0, KEY_1, KEY_2, KEY_3, KEY_4, KEY_5, KEY_6, KEY_7, KEY_8, KEY_9, KEY_A, KEY_ADD, KEY_ALT, KEY_B, KEY_BACKSPACE, KEY_BACK_SLASH, KEY_C, KEY_CAPS_LOCK, KEY_CLOSE_BRACKET, KEY_COMMA, KEY_CONTEXT_MENU, KEY_CONTROL, KEY_D, KEY_DECIMAL, KEY_DELETE, KEY_DIVIDE, KEY_DOWN, KEY_E, KEY_END, KEY_ENTER, KEY_EQUAL, KEY_ESCAPE, KEY_F, KEY_F1, KEY_F10, KEY_F11, KEY_F12, KEY_F2, KEY_F3, KEY_F4, KEY_F5, KEY_F6, KEY_F7, KEY_F8, KEY_F9, KEY_G, KEY_H, KEY_HOME, KEY_I, KEY_INSERT, KEY_J, KEY_K, KEY_L, KEY_LEFT, KEY_M, KEY_META, KEY_MULTIPLY, KEY_N, KEY_NUMPAD_0, KEY_NUMPAD_1, KEY_NUMPAD_2, KEY_NUMPAD_3, KEY_NUMPAD_4, KEY_NUMPAD_5, KEY_NUMPAD_6, KEY_NUMPAD_7, KEY_NUMPAD_8, KEY_NUMPAD_9, KEY_O, KEY_OPEN_BRACKET, KEY_P, KEY_PAGE_DOWN, KEY_PAGE_UP, KEY_PAUSE, KEY_PERIOD, KEY_PRINT_SCREEN, KEY_Q, KEY_R, KEY_RETURN, KEY_RIGHT, KEY_S, KEY_SEMICOLON, KEY_SEPARATOR, KEY_SHIFT, KEY_SLASH, KEY_SPACE, KEY_SUBTRACT, KEY_T, KEY_TAB, KEY_U, KEY_UP, KEY_V, KEY_W, KEY_WINDOWS, KEY_X, KEY_Y, KEY_Z, MOUSEBUTTON_LEFT, MOUSEBUTTON_MIDDLE, MOUSEBUTTON_NONE, MOUSEBUTTON_RIGHT, PAD_1, PAD_2, PAD_3, PAD_4, PAD_DOWN, PAD_FACE_1, PAD_FACE_2, PAD_FACE_3, PAD_FACE_4, PAD_LEFT, PAD_L_SHOULDER_1, PAD_L_SHOULDER_2, PAD_L_STICK_BUTTON, PAD_L_STICK_X, PAD_L_STICK_Y, PAD_RIGHT, PAD_R_SHOULDER_1, PAD_R_SHOULDER_2, PAD_R_STICK_BUTTON, PAD_R_STICK_X, PAD_R_STICK_Y, PAD_SELECT, PAD_START, PAD_UP, PAD_VENDOR };
