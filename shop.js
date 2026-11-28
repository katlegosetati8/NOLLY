/* Nolly shop: customer accounts, cart, confirm order, My orders.
   Loaded by index.html after the Firebase scripts. Prices come from Firestore settings/prices (set on the admin page). */
(function () {
  if (typeof firebase === "undefined" || !nollyDb) return;
  const auth = firebase.auth(), db = nollyDb;
  const R = n => "R" + (Number(n) || 0).toFixed(2).replace(/\.00$/, "");
  const $ = (s, r) => (r || document).querySelector(s);
  let prices = {}, lastType = "general", cart = [], user = null, view = "cart", msg = "";
  try { cart = JSON.parse(localStorage.getItem("nollyCart") || "[]"); } catch (e) {}
  const save = () => { try { localStorage.setItem("nollyCart", JSON.stringify(cart)); } catch (e) {} badge(); };
  db.collection("settings").doc("prices").get().then(d => { if (d.exists) prices = d.data(); }).catch(() => {});

  /* nav buttons + dialog */
  const nav = $(".nav-right");
  nav.insertAdjacentHTML("afterbegin", '<button class="admin-btn" id="acctBtn" type="button" style="animation:none">👤 <span class="admin-text">Log in</span></button><button class="admin-btn" id="cartBtn" type="button" style="animation:none">🛒 <span id="cartCount">0</span></button>');
  document.body.insertAdjacentHTML("beforeend", '<dialog id="shopDialog" class="login-dialog" style="width:min(520px,94vw);max-height:92vh;overflow-y:auto"><div class="login-form" id="shopBody"></div></dialog>');
  const dlg = $("#shopDialog"), body = $("#shopBody");
  dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
  const badge = () => { $("#cartCount").textContent = cart.reduce((a, l) => a + l.qty, 0); };
  const open = v => { view = v; msg = ""; draw(); if (!dlg.open) dlg.showModal(); };
  $("#cartBtn").onclick = () => open("cart");
  $("#acctBtn").onclick = () => open(user ? "orders" : "login");
  badge();

  auth.onAuthStateChanged(u => {
    user = u;
    $("#acctBtn .admin-text").textContent = u ? (u.displayName || "My account").split(" ")[0] : "Log in";
    if (dlg.open) draw();
  });

  /* order form: capture "Add to cart" instead of sending straight away */
  document.addEventListener("click", e => { const b = e.target.closest("[data-order]"); if (b) { lastType = b.dataset.order; setTimeout(() => { const s = $("#orderForm .login-submit"); if (s) s.textContent = "Add to cart"; if (!$("#logoFile")) $("#orderFields").insertAdjacentHTML("beforeend", '<div><label for="logoFile">Your logo or design (optional picture)</label><input type="file" id="logoFile" accept="image/*"></div>'); }, 0); } }, true);
  document.addEventListener("submit", async e => {
    if (e.target.id !== "orderForm") return;
    e.stopImmediatePropagation(); e.preventDefault();
    const st = $("#orderStatus"), f = $("#orderFields"), details = {}; let qty = 0;
    f.querySelectorAll("[data-label]").forEach(el => { const v = el.value.trim(); if (v) { details[el.dataset.label] = v; if (el.dataset.label === "Quantity") qty = Number(v); } });
    const sz = []; f.querySelectorAll("[data-size]").forEach(el => { const n = Number(el.value); if (n > 0) { sz.push(el.dataset.size + " x " + n); qty += n; } });
    if (sz.length) details.Sizes = sz.join(", ");
    if (!(qty > 0)) { st.textContent = "Please enter the quantity (or sizes)."; return; }
    let logo = null; const lf = $("#logoFile");
    if (lf && lf.files[0]) { try { logo = await shrink(lf.files[0]); } catch (x) { st.textContent = "Could not read that picture. Try a JPG or PNG."; return; } }
    cart.push({ type: lastType, title: currentItem.title, qty, unit: Number(prices[lastType]) || 0, details, logo });
    save(); $("#orderDialog").close(); $("#orderForm").reset(); open("cart");
  }, true);

  /* shrink a picture to about 300 KB so it fits in the database */
  const shrink = f => new Promise((res, rej) => { const u = URL.createObjectURL(f), i = new Image(); i.onerror = rej;
    i.onload = () => { let m = 1000, q = .85; for (;;) { const k = Math.min(1, m / Math.max(i.width, i.height)), c = document.createElement("canvas"); c.width = Math.round(i.width * k); c.height = Math.round(i.height * k);
      const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(i, 0, 0, c.width, c.height);
      const d = c.toDataURL("image/jpeg", q); if (d.length < 350000 || m < 300) { URL.revokeObjectURL(u); return res(d); } m -= 150; q = .8; } }; i.src = u; });
  const total = () => cart.reduce((a, l) => a + l.qty * l.unit, 0);
  const lineHtml = (l, i, ed) => '<div style="border:1px solid rgba(226,178,76,.4);border-radius:12px;padding:12px;margin:8px 0;font-size:14px"><b style="color:var(--gold)">' + esc(l.title) + '</b> &middot; ' + l.qty + ' x ' + (l.unit ? R(l.unit) : "price TBC") + ' = <b>' + R(l.qty * l.unit) + '</b><br><span style="color:#dbe3ff">' +
    Object.keys(l.details).map(k => esc(k) + ": " + esc(l.details[k])).join("<br>") + "</span>" + (l.logo ? "<br>🖼️ Logo attached" : "") + (ed ? '<br><button type="button" class="login-close" style="position:static;font-size:13px" data-rm="' + i + '">Remove</button>' : "") + "</div>";
  const fld = (id, label, type, ac) => '<label for="' + id + '">' + label + '</label><input id="' + id + '" type="' + type + '" autocomplete="' + (ac || "off") + '">';

  function draw() {
    let h = '<button type="button" class="login-close" id="shopX" aria-label="Close">✕</button>';
    if (view === "login" || view === "signup") {
      const su = view === "signup";
      h += "<h2>" + (su ? "Create account" : "Log in") + "</h2>" + (su ? fld("sName", "Your name", "text", "name") + fld("sPhone", "WhatsApp number", "tel", "tel") : "") + fld("sEmail", "Email", "email", "email") + fld("sPass", "Password (6+ characters)", "password", su ? "new-password" : "current-password") +
        '<button class="btn btn-primary login-submit" id="authGo" type="button">' + (su ? "Create my account" : "Log in") + '</button><button class="login-close" style="position:static;margin-top:8px;font-size:14px" id="swap" type="button">' + (su ? "Have an account? Log in" : "New here? Create an account") + "</button>" + (su ? "" : '<button class="login-close" style="position:static;font-size:14px" id="forgot" type="button">Forgot password?</button>');
    } else if (view === "orders") {
      h += "<h2>My orders</h2><p style='color:#dbe3ff;font-size:14px'>" + esc(user ? user.email : "") + '</p><div id="myOrders">Loading...</div><button class="btn btn-outline login-submit" id="logout" type="button">Log out</button>';
    } else {
      h += "<h2>My cart</h2>" + (cart.length ? cart.map((l, i) => lineHtml(l, i, true)).join("") + '<p style="font-size:20px;text-align:right;margin-top:10px">Total: <b style="color:var(--gold)">' + R(total()) + '</b></p><button class="btn btn-primary login-submit" id="confirm" type="button">Confirm order</button>' : "<p>Your cart is empty. Pick a product in the gallery and press its button.</p>");
    }
    body.innerHTML = h + '<p class="login-status" id="shopMsg">' + esc(msg) + "</p>";
    if (view === "orders") loadOrders();
  }

  const say = t => { msg = t; const m = $("#shopMsg"); if (m) m.textContent = t; };
  body.addEventListener("click", async e => {
    const id = e.target.id;
    if (id === "shopX") dlg.close();
    else if (e.target.dataset.rm !== undefined) { cart.splice(+e.target.dataset.rm, 1); save(); draw(); }
    else if (id === "swap") { view = view === "login" ? "signup" : "login"; draw(); }
    else if (id === "logout") { await auth.signOut(); dlg.close(); }
    else if (id === "forgot") { const em = $("#sEmail").value.trim(); if (!em) return say("Type your email first."); auth.sendPasswordResetEmail(em).then(() => say("Reset link sent. Check your email."), () => say("Could not send the link.")); }
    else if (id === "authGo") {
      const em = $("#sEmail").value.trim(), pw = $("#sPass").value;
      try {
        if (view === "signup") {
          const name = $("#sName").value.trim(); if (!name) return say("Please enter your name.");
          const c = await auth.createUserWithEmailAndPassword(em, pw);
          await c.user.updateProfile({ displayName: name });
          await db.collection("users").doc(c.user.uid).set({ name, phone: $("#sPhone").value.trim(), email: em });
        } else await auth.signInWithEmailAndPassword(em, pw);
        open(cart.length ? "cart" : "orders");
      } catch (err) { say(err.code === "auth/email-already-in-use" ? "That email already has an account. Log in instead." : err.code === "auth/weak-password" ? "Password must be 6+ characters." : "Could not continue. Check your email and password."); }
    } else if (id === "confirm") {
      if (!user) { open("login"); return say("Log in or create an account to confirm your order."); }
      if (cart.some(l => !l.unit)) return say("An item has no price yet. Please WhatsApp us for it.");
      e.target.disabled = true;
      const t = total(), snap = await db.collection("users").doc(user.uid).get().catch(() => null), p = snap && snap.exists ? snap.data().phone || "" : "";
      const text = ["*New order*", "Name: " + (user.displayName || user.email), p && "Phone: " + p].filter(Boolean).concat(cart.map(l => "- " + l.title + " x " + l.qty + " = " + R(l.qty * l.unit) + " (" + Object.keys(l.details).map(k => k + ": " + l.details[k]).join("; ") + ")"), ["TOTAL: " + R(t), "", "I will send my logo or design in this chat."]).join("\n");
      try {
        const ref = await db.collection("orders").add({ uid: user.uid, name: user.displayName || "", email: user.email, phone: p, item: cart.map(l => l.title + " x" + l.qty).join(", "), details: { Order: text }, lines: cart.map(l => Object.assign({}, l, { logo: !!l.logo })), total: t, paid: 0, payments: [], status: "New", createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        window.open("https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(text), "_blank");
        for (const l of cart) if (l.logo) await db.collection("orderLogos").add({ orderId: ref.id, uid: user.uid, name: user.displayName || user.email, item: l.title, data: l.logo, createdAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
        cart = []; save(); open("orders");
      } catch (err) { e.target.disabled = false; say("Could not save the order. Please try again."); }
    }
  });

  function loadOrders() {
    db.collection("orders").where("uid", "==", user.uid).get().then(s => {
      const o = s.docs.map(d => d.data()).sort((a, b) => (b.createdAt ? b.createdAt.seconds : 0) - (a.createdAt ? a.createdAt.seconds : 0));
      const t = o.reduce((a, x) => a + (x.total || 0), 0);
      $("#myOrders").innerHTML = o.length ? "<p>Total ordered: <b style='color:var(--gold)'>" + R(t) + "</b></p>" + o.map(x => '<div style="border:1px solid rgba(226,178,76,.4);border-radius:12px;padding:12px;margin:8px 0;font-size:14px"><b>' + esc(x.item) + "</b><br>Total " + R(x.total) + " &middot; Paid " + R(x.paid) + " &middot; Owing <b>" + R((x.total || 0) - (x.paid || 0)) + "</b><br>Status: " + esc(x.status) + (x.createdAt ? " &middot; " + x.createdAt.toDate().toLocaleDateString() : "") + "</div>").join("") : "<p>No orders yet.</p>";
    }).catch(() => { $("#myOrders").textContent = "Could not load your orders."; });
  }
})();
