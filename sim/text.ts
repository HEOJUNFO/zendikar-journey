// Korean helpers for log lines written by the engine.

// 0 = no final consonant (or not Hangul), 8 = ㄹ.
function finalConsonant(word: string) {
  const last = word.trim().at(-1);
  if (!last) return 0;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return 0;
  return (code - 0xac00) % 28;
}

// josa('이오나', '이', '가') -> '이오나가'
export function josa(word: string, withFinal: string, withoutFinal: string) {
  return word + (finalConsonant(word) ? withFinal : withoutFinal);
}

// '용암 협곡' -> '용암 협곡으로', '에메리아' -> '에메리아로'
export function toward(word: string) {
  const f = finalConsonant(word);
  return word + (f && f !== 8 ? '으로' : '로');
}

// "이오나, 에메리아의 방패" -> "이오나"
export function shortName(name: string) {
  return name.split(',')[0].trim();
}
