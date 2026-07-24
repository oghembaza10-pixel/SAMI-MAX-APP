const TOKEN = "TON_ACCESS_TOKEN";

async function test(name, url) {
  try {
    const res = await fetch(`https://graph.facebook.com/v25.0/${url}&access_token=${TOKEN}`);
    const json = await res.json();

    console.log("\n==============================");
    console.log(name);
    console.log("==============================");
    console.dir(json, { depth: null });
  } catch (e) {
    console.error(name, e.message);
  }
}

(async () => {
  await test("Permissions", "me/permissions?");
  await test("Utilisateur", "me?fields=id,name&");
  await test("Pages", "me/accounts?");
  await test("Business", "me/businesses?");
})();
