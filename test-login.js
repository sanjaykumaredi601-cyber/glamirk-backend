import fetch from 'node-fetch'; // Not needed in node 18+, but whatever.

(async () => {
  try {
    // We don't have a valid ID token easily, but we can trigger verifyAuth with a fake token
    const res = await fetch('http://localhost:5000/api/admin/login', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer fake_token', 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    console.log(res.status);
    console.log(await res.json());
  } catch (e) {
    console.error(e);
  }
})();
