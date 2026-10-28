// The privacy page + class terms are linked from the hub only when this says live. docs/launch/fill-legal.sh turns it on
// (with the real name, email and country in site/hub/legal/*.html); site/hub/test/legal.test.mjs refuses a live flag
// next to a placeholder. Kept off until then so a link can never lead to a page that does not exist.
window.STASH_LEGAL = { live: false };
