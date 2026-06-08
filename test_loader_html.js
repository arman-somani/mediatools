(async () => {
  const r = await fetch('https://dave15.savenow.to/pacific/?eHiXKcrS5UVOzjOS2Munlrb');
  console.log(await r.text());
})();
