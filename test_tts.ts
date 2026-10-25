async function test() {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=Hello+world&tl=en&client=tw-ob`;
  const res = await fetch(url);
  console.log(res.status, res.headers.get('content-type'));
}
test();
