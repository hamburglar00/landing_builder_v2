// Filesystem roots, not a component in a longer API/URL path. Bare ambiguous
// roots still match, and another real path on the same line is never excluded.
export const personalPathPattern=/(?:[A-Z]:(?:\\{1,2}|\/)Users(?:\\{1,2}|\/)[^\s"'`]+|(?:\bfile:\/\/|(?<![\w.\/\\-]))\/+(?:Users|home)\/[^\s"'`]+)/i;
export const hasPersonalPath=text=>personalPathPattern.test(text);
