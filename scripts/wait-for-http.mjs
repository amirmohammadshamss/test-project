const url = process.argv[2];
if (!url || !['http:', 'https:'].includes(new URL(url).protocol))
  throw new Error('Provide an HTTP health URL');
const deadline = Date.now() + 120000;
let ready = false;
while (Date.now() < deadline) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {
    /* Startup may still be in progress. */
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!ready) {
  console.error('Service did not become ready within 120 seconds');
  process.exit(1);
}
console.log('HTTP readiness confirmed');
