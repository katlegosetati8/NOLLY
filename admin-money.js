/* Admin "Money" tab: prices, payments, expenses, totals. Loaded at the end of admin.html. */
(function () {
  if (typeof auth === "undefined" || !auth) return;
  const R = n => "R" + (Number(n) || 0).toFixed(2).replace(/\.00$/, "");
  const $ = id => document.getElementById(id);
  const TYPES = { golf: "Golf T-shirt", caps: "Cap", shawls: "Wedding shawl", bridal: "Bridal gown/robe", general: "Other / custom item" };
  const fv = firebase.firestore.FieldValue;
  let ords = [], exps = [], started = false;

  document.querySelector(".tabs").insertAdjacentHTML("beforeend", '<button class="tab" data-tab="money" type="button">💰 Money</button>');
  document.querySelector("main").insertAdjacentHTML("beforeend", '<section class="panel" id="tab-money" hidden><h2>Money</h2><p class="hint">Set your prices, record payments and expenses, and see what you have earned.</p>' +
    '<div class="card" id="mTotals"></div>' +
    '<div class="card"><h3 style="color:var(--gold)">Prices (per item)</h3><div class="grid2" id="priceBox"></div><button class="btn small" id="priceSave" type="button" style="margin-top:12px">Save prices</button><p class="msg" id="priceMsg"></p></div>' +
    '<div class="card"><h3 style="color:var(--gold)">Record a payment</h3><label for="payOrder">Order</label><select id="payOrder"></select><div class="grid2"><div><label for="payAmt">Amount (R)</label><input id="payAmt" type="number" min="1"></div><div><label for="payMethod">Method</label><select id="payMethod"><option>Cash</option><option>EFT</option><option>Card</option></select></div></div><button class="btn small" id="payBtn" type="button" style="margin-top:12px">Save payment</button><p class="msg" id="payMsg"></p></div>' +
    '<div class="card"><h3 style="color:var(--gold)">Add an expense</h3><div class="grid2"><div><label for="expWhat">What for</label><input id="expWhat" placeholder="e.g. Thread, shirts"></div><div><label for="expAmt">Amount (R)</label><input id="expAmt" type="number" min="1"></div></div><button class="btn small" id="expBtn" type="button" style="margin-top:12px">Save expense</button><p class="msg" id="expMsg"></p><div id="expList"></div></div>' +
    '<div class="card"><h3 style="color:var(--gold)">Who still owes you</h3><div id="owing"></div></div></section>');
  $("priceBox").innerHTML = Object.keys(TYPES).map(k => '<div><label for="pr_' + k + '">' + TYPES[k] + ' (R)</label><input id="pr_' + k + '" type="number" min="0"></div>').join("");

  document.addEventListener("click", e => {
    const t = e.target.closest(".tab"); if (!t) return;
    document.querySelectorAll(".panel").forEach(p => p.hidden = p.id !== "tab-" + t.dataset.tab);
    document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x === t));
  });

  auth.onAuthStateChanged(u => {
    if (!u || started) return; started = true;
    db.collection("settings").doc("prices").get().then(d => { if (d.exists) Object.keys(TYPES).forEach(k => { $("pr_" + k).value = d.data()[k] || ""; }); }).catch(() => {});
    db.collection("orders").onSnapshot(s => { ords = s.docs.map(d => Object.assign({ id: d.id }, d.data())); draw(); });
    db.collection("expenses").orderBy("at", "desc").onSnapshot(s => { exps = s.docs.map(d => Object.assign({ id: d.id }, d.data())); draw(); });
  });

  function draw() {
    const live = ords.filter(o => o.status !== "Cancelled"), pays = [].concat(...ords.map(o => o.payments || []));
    const m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0);
    const got = ords.reduce((a, o) => a + (o.paid || 0), 0), month = pays.filter(p => p.date >= m0.getTime()).reduce((a, p) => a + p.amount, 0);
    const owed = live.reduce((a, o) => a + Math.max(0, (o.total || 0) - (o.paid || 0)), 0), ex = exps.reduce((a, x) => a + x.amount, 0);
    const box = (l, v, c) => '<div style="flex:1;min-width:140px"><div style="font-size:12px;color:var(--muted)">' + l + '</div><div style="font-size:24px;font-weight:800;color:' + (c || "var(--gold)") + '">' + R(v) + "</div></div>";
    $("mTotals").innerHTML = '<div style="display:flex;gap:16px;flex-wrap:wrap">' + box("Money received (all time)", got) + box("Received this month", month) + box("Still owed to you", owed, "#ffb86b") + box("Expenses", ex, "#ff9b94") + box("Profit (received − expenses)", got - ex, got - ex >= 0 ? "#7be495" : "#ff9b94") + "</div>";
    const open = live.filter(o => (o.total || 0) > (o.paid || 0));
    $("payOrder").innerHTML = open.map(o => '<option value="' + o.id + '">' + esc((o.name || o.email || "Customer") + " - " + (o.item || "")) + " (owes " + R(o.total - (o.paid || 0)) + ")</option>").join("") || "<option value=''>No unpaid orders</option>";
    $("owing").innerHTML = open.map(o => "<p>" + esc(o.name || o.email) + ": <b>" + R(o.total - (o.paid || 0)) + "</b> of " + R(o.total) + "</p>").join("") || "<p>Nobody owes you anything.</p>";
    $("expList").innerHTML = exps.slice(0, 15).map(x => "<p>" + new Date(x.at).toLocaleDateString() + " · " + esc(x.what) + " · <b>" + R(x.amount) + '</b> <button class="link" type="button" data-delexp="' + x.id + '">delete</button></p>').join("");
  }

  $("priceSave").onclick = () => { const d = {}; Object.keys(TYPES).forEach(k => d[k] = Number($("pr_" + k).value) || 0); db.collection("settings").doc("prices").set(d).then(() => setMsg($("priceMsg"), "Prices saved."), () => setMsg($("priceMsg"), "Could not save.", true)); };
  $("payBtn").onclick = () => { const id = $("payOrder").value, a = Number($("payAmt").value); if (!id || !(a > 0)) return setMsg($("payMsg"), "Choose an order and an amount.", true);
    db.collection("orders").doc(id).update({ paid: fv.increment(a), payments: fv.arrayUnion({ amount: a, method: $("payMethod").value, date: Date.now() }) }).then(() => { $("payAmt").value = ""; setMsg($("payMsg"), "Payment saved."); }, () => setMsg($("payMsg"), "Could not save.", true)); };
  $("expBtn").onclick = () => { const w = $("expWhat").value.trim(), a = Number($("expAmt").value); if (!w || !(a > 0)) return setMsg($("expMsg"), "Enter what for and the amount.", true);
    db.collection("expenses").add({ what: w, amount: a, at: Date.now() }).then(() => { $("expWhat").value = $("expAmt").value = ""; setMsg($("expMsg"), "Saved."); }, () => setMsg($("expMsg"), "Could not save.", true)); };
  $("expList").addEventListener("click", e => { const id = e.target.dataset.delexp; if (id && confirm("Delete this expense?")) db.collection("expenses").doc(id).delete(); });
})();

/* Admin "Logos" tab: pictures customers uploaded with their orders. */
(function () {
  if (typeof auth === "undefined" || !auth) return;
  document.querySelector(".tabs").insertAdjacentHTML("beforeend", '<button class="tab" data-tab="logos" type="button">🖼️ Logos</button>');
  document.querySelector("main").insertAdjacentHTML("beforeend", '<section class="panel" id="tab-logos" hidden><h2>Customer logos</h2><p class="hint">Pictures customers attached to their orders. Press Download to save one for printing.</p><div id="logoList"></div></section>');
  let started = false;
  auth.onAuthStateChanged(u => {
    if (!u || started) return; started = true;
    db.collection("orderLogos").orderBy("createdAt", "desc").onSnapshot(s => {
      document.getElementById("logoList").innerHTML = s.docs.map(d => { const x = d.data(); return '<div class="card" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><img src="' + x.data + '" alt="" style="height:90px;border-radius:8px;background:#fff"><div><b>' + esc(x.name) + "</b><br>" + esc(x.item) + (x.createdAt ? "<br>" + x.createdAt.toDate().toLocaleDateString() : "") + '<br><a class="btn ghost small" download="logo-' + esc((x.name || "customer").replace(/\W+/g, "-")) + '.jpg" href="' + x.data + '">Download</a></div></div>'; }).join("") || "<p>No logos yet.</p>";
    });
  });
})();
