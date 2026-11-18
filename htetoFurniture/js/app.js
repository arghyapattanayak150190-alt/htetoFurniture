(() => {
  "use strict";

  const CART_KEY = "hecto-cart";
  const SETTINGS_KEY = "hecto-settings";
  const PROMO_KEY = "hecto-promo";
  const CLIENT_AUTH_KEY = "hecto-client-auth";
  const DEMO_CLIENT = {
    email: "demo@hectofurnitures.com",
    password: "demo1234",
    name: "Demo Customer"
  };
  const DEFAULT_CART = [
    { id: "meridian-lounge-chair", name: "Meridian Lounge Chair", price: 1299, quantity: 1, image: "images/product-chair.jpg" },
    { id: "arc-brass-floor-lamp", name: "Arc Brass Floor Lamp", price: 680, quantity: 2, image: "images/product-lamp.jpg" },
    { id: "monolith-travertine-table", name: "Monolith Travertine Table", price: 950, quantity: 1, image: "images/product-table.jpg" }
  ];

  let toastTimer;
  const toast = (message) => {
    let node = document.getElementById("site-message");
    if (!node) {
      node = document.createElement("div");
      node.id = "site-message";
      node.setAttribute("role", "status");
      node.setAttribute("aria-live", "polite");
      Object.assign(node.style, {
        position: "fixed", right: "20px", bottom: "20px", zIndex: "9999",
        maxWidth: "min(420px, calc(100vw - 40px))", padding: "14px 18px",
        background: "#1a1a1a", color: "#fff", borderRadius: "6px",
        boxShadow: "0 6px 24px rgba(0,0,0,.2)", font: "14px/1.5 sans-serif",
        opacity: "0", transition: "opacity .2s"
      });
      document.body.append(node);
    }
    node.textContent = message;
    node.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { node.style.opacity = "0"; }, 3500);
  };

  const readStorage = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (error) {
      console.error(`Unable to read ${key} from browser storage.`, error);
      toast("Browser storage is unavailable. Changes may not be saved.");
      return fallback;
    }
  };

  const writeStorage = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Unable to save ${key} to browser storage.`, error);
      toast("Could not save your changes in this browser.");
      return false;
    }
  };

  const money = (amount) => `₹${Math.round(amount).toLocaleString("en-IN")}`;
  const parsePrice = (text) => {
    const firstAmount = (text || "").match(/[\d,]+(?:\.\d+)?/);
    return firstAmount ? Number(firstAmount[0].replace(/,/g, "")) || 0 : 0;
  };
  const slug = (text) => text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const pageName = location.pathname.split("/").pop() || "index.html";

  let cart = readStorage(CART_KEY, DEFAULT_CART);
  if (!Array.isArray(cart)) cart = DEFAULT_CART.map((item) => ({ ...item }));
  cart = cart.filter((item) => item && typeof item.name === "string" && Number(item.price) >= 0)
    .map((item) => ({ ...item, quantity: Math.max(1, Number(item.quantity) || 1) }));
  writeStorage(CART_KEY, cart);

  let promo = readStorage(PROMO_KEY, { code: "GENWALNUT", type: "flat", value: 300 });
  if (!promo || !Number.isFinite(Number(promo.value))) promo = { code: "", type: "flat", value: 0 };

  function cartCount() {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }

  function subtotal() {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  }

  function discountAmount() {
    const raw = promo.type === "percentage" ? subtotal() * Number(promo.value) / 100 : Number(promo.value);
    return Math.max(0, Math.min(subtotal(), raw));
  }

  function saveCart() {
    writeStorage(CART_KEY, cart);
    updateCartBadges();
    renderCart();
    updateCheckoutSummary();
  }

  function updateCartBadges() {
    document.querySelectorAll(".cart-badge").forEach((badge) => {
      badge.textContent = String(cartCount());
      badge.setAttribute("aria-label", `${cartCount()} items in cart`);
    });
  }

  function createCartRow(item) {
    const row = document.createElement("div");
    row.className = "cart-item";
    row.dataset.productId = item.id;

    const product = document.createElement("div");
    product.className = "cart-item-product";
    const image = document.createElement("img");
    image.className = "cart-item-img";
    image.src = item.image;
    image.alt = item.name;
    const info = document.createElement("div");
    info.className = "cart-item-info";
    const name = document.createElement("h4");
    name.textContent = item.name;
    info.append(name);
    product.append(image, info);

    const price = document.createElement("span");
    price.className = "cart-item-price";
    const quantity = document.createElement("div");
    quantity.className = "qty-selector";
    const decrease = document.createElement("button");
    decrease.className = "qty-btn";
    decrease.type = "button";
    decrease.textContent = "-";
    decrease.setAttribute("aria-label", `Decrease ${item.name} quantity`);
    const value = document.createElement("span");
    value.className = "qty-value";
    const increase = document.createElement("button");
    increase.className = "qty-btn";
    increase.type = "button";
    increase.textContent = "+";
    increase.setAttribute("aria-label", `Increase ${item.name} quantity`);
    quantity.append(decrease, value, increase);

    const lineTotal = document.createElement("span");
    lineTotal.className = "cart-item-subtotal";
    const remove = document.createElement("button");
    remove.className = "remove-btn";
    remove.type = "button";
    remove.textContent = "×";
    remove.title = "Remove";
    row.append(product, price, quantity, lineTotal, remove);
    return row;
  }

  function renderCart() {
    const container = document.getElementById("cart-items");
    if (!container) return;
    let rows = [...container.querySelectorAll(".cart-item")];
    cart.forEach((item) => {
      let row = rows.find((candidate) => candidate.dataset.productId === item.id)
        || rows.find((candidate) => candidate.querySelector(".cart-item-info h4")?.textContent === item.name);
      if (!row) {
        row = createCartRow(item);
        container.insertBefore(row, container.querySelector("#promo-section"));
      }
      row.dataset.productId = item.id;
      const name = row.querySelector(".cart-item-info h4");
      const image = row.querySelector(".cart-item-img");
      if (name) name.textContent = item.name;
      if (image) {
        image.src = item.image;
        image.alt = item.name;
      }
      const price = row.querySelector(".cart-item-price");
      const quantity = row.querySelector(".qty-value");
      const lineTotal = row.querySelector(".cart-item-subtotal");
      if (price) price.textContent = money(item.price);
      if (quantity) quantity.textContent = String(item.quantity);
      if (lineTotal) lineTotal.textContent = money(item.price * item.quantity);
      rows = rows.filter((candidate) => candidate !== row);
    });
    rows.forEach((row) => row.remove());

    const empty = document.getElementById("cart-empty-message");
    if (cart.length === 0 && !empty) {
      const message = document.createElement("p");
      message.id = "cart-empty-message";
      message.textContent = "Your curated bag is empty.";
      container.insertBefore(message, container.querySelector("#promo-section"));
    } else if (cart.length > 0) {
      empty?.remove();
    }

    const summary = document.getElementById("order-summary");
    if (summary) {
      setSummaryValue(summary, "Subtotal", money(subtotal()));
      setSummaryValue(summary, "Studio Discount", `-${money(discountAmount())}`);
      const total = summary.querySelector(".summary-total .amount");
      if (total) total.textContent = money(subtotal() - discountAmount());
    }
  }

  function setSummaryValue(container, label, value) {
    const row = [...container.querySelectorAll(".summary-row")]
      .find((candidate) => candidate.firstElementChild?.textContent.trim().startsWith(label));
    if (row?.lastElementChild) row.lastElementChild.textContent = value;
  }

  function updateCheckoutSummary() {
    const summary = document.getElementById("checkout-summary");
    if (!summary) return;
    summary.querySelectorAll(".summary-item").forEach((item) => item.remove());
    const divider = summary.querySelector(".summary-divider");
    cart.forEach((item) => {
      const row = document.createElement("div");
      row.className = "summary-item";
      const image = document.createElement("img");
      image.className = "summary-item-img";
      image.src = item.image;
      image.alt = item.name;
      const info = document.createElement("div");
      info.className = "summary-item-info";
      const name = document.createElement("h4");
      name.textContent = item.name;
      const quantity = document.createElement("p");
      quantity.textContent = `Qty: ${item.quantity}`;
      info.append(name, quantity);
      const price = document.createElement("span");
      price.className = "summary-item-price";
      price.textContent = money(item.price * item.quantity);
      row.append(image, info, price);
      summary.insertBefore(row, divider);
    });
    setSummaryValue(summary, "Subtotal", money(subtotal()));
    setSummaryValue(summary, "Discount", `-${money(discountAmount())}`);
    const total = summary.querySelector(".summary-total .amount");
    const expedited = document.querySelector(".shipping-option.selected")?.id === "shipping-expedited";
    setSummaryValue(summary, "White-Glove Delivery", expedited ? money(150) : "FREE");
    if (total) total.textContent = money(subtotal() + (expedited ? 150 : 0) - discountAmount());
  }

  function addToCart(source) {
    const card = source.closest(".product-card");
    if (!card) {
      toast("This item could not be added to your bag.");
      return;
    }
    const name = card.querySelector(".product-card-name")?.textContent.trim();
    const price = parsePrice(card.querySelector(".product-card-price")?.textContent);
    const image = card.querySelector("img")?.getAttribute("src");
    if (!name || price <= 0 || !image) {
      toast("This product is missing its name, price, or image.");
      return;
    }
    const id = slug(name);
    const existing = cart.find((item) => item.id === id);
    if (existing) existing.quantity += 1;
    else cart.push({ id, name, price, image, quantity: 1 });
    saveCart();
    toast(`${name} added to your curated bag.`);
  }

  function bindForms() {
    const adminForm = document.getElementById("login-form");
    const clientForm = document.getElementById("client-login-form");
    const registrationForm = document.getElementById("client-register-form");
    const confirmPassword = document.getElementById("confirm-password");
    const password = document.getElementById("reg-password");
    const phoneFields = document.querySelectorAll('input[type="tel"][required]');

    phoneFields.forEach((field) => {
      const validatePhone = () => {
        const digitCount = field.value.replace(/\D/g, "").length;
        field.setCustomValidity(field.value && digitCount < 7
          ? "Enter a phone number with at least 7 digits."
          : "");
      };
      field.addEventListener("input", validatePhone);
      validatePhone();
    });

    if (confirmPassword && password) {
      const checkMatch = () => {
        confirmPassword.setCustomValidity(
          confirmPassword.value && confirmPassword.value !== password.value
            ? "Passwords do not match."
            : ""
        );
      };
      password.addEventListener("input", checkMatch);
      confirmPassword.addEventListener("input", checkMatch);
    }

    [
      [adminForm, "Admin sign-in"],
      [clientForm, "Customer sign-in"]
    ].forEach(([form, label]) => {
      form?.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;

        if (form === clientForm) {
          const email = document.getElementById("email")?.value.trim().toLowerCase();
          const submittedPassword = document.getElementById("password")?.value;

          if (email !== DEMO_CLIENT.email || submittedPassword !== DEMO_CLIENT.password) {
            toast("Invalid demo credentials. Use demo@hectofurnitures.com / demo1234.");
            return;
          }

          writeStorage(CLIENT_AUTH_KEY, {
            email: DEMO_CLIENT.email,
            name: DEMO_CLIENT.name
          });
          toast("Signed in successfully.");
          setTimeout(() => { location.href = "client-home.html"; }, 300);
          return;
        }

        toast(`${label} details are valid. Connect a server-side authentication service to sign in.`);
      });
    });

    registrationForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!registrationForm.reportValidity()) return;
      toast("Your details are valid. Account creation requires a server-side registration service.");
    });

    const deliveryForm = document.getElementById("delivery-form");
    document.getElementById("btn-place-order")?.addEventListener("click", () => {
      if (!deliveryForm?.reportValidity()) return;
      toast("Delivery details are valid. Payment and order placement are not connected in this demo.");
    });

    document.getElementById("btn-subscribe")?.addEventListener("click", () => {
      const email = document.getElementById("newsletter-email");
      if (!email) return;
      email.setAttribute("required", "");
      email.setAttribute("aria-label", "Email address for newsletter");
      if (!email.reportValidity()) return;
      toast("Email address is valid. Newsletter subscription requires a server connection.");
    });

    document.getElementById("btn-apply-promo")?.addEventListener("click", () => {
      const input = document.getElementById("promo-input");
      const code = input?.value.trim().toUpperCase();
      if (code === "GENWALNUT") promo = { code, type: "flat", value: 300 };
      else if (code === "ARCH20") promo = { code, type: "percentage", value: 20 };
      else {
        promo = { code: "", type: "flat", value: 0 };
        writeStorage(PROMO_KEY, promo);
        renderCart();
        updateCheckoutSummary();
        toast("That promo code is not valid.");
        return;
      }
      writeStorage(PROMO_KEY, promo);
      renderCart();
      updateCheckoutSummary();
      toast(`Promo code ${code} applied.`);
    });
  }

  function bindShop() {
    const grid = document.getElementById("product-grid");
    if (!grid) return;
    const cards = () => [...grid.querySelectorAll(".product-card")];
    const applyCategory = (category) => {
      const terms = {
        "living room": ["chair", "armchair", "cabinet"],
        bedroom: ["bed"],
        dining: ["table"],
        office: ["office", "desk"],
        outdoor: ["outdoor"],
        lighting: ["lamp"]
      };
      const selectedTerms = terms[category.toLowerCase()] || [];
      cards().forEach((card) => {
        const text = card.textContent.toLowerCase();
        card.hidden = selectedTerms.length > 0 && !selectedTerms.some((term) => text.includes(term));
      });
      const title = document.getElementById("page-title");
      if (title) title.textContent = category === "All" ? "Curated Seating" : `Curated ${category}`;
    };

    const queryCategory = new URLSearchParams(location.search).get("category");
    if (queryCategory) applyCategory(queryCategory);

    document.querySelectorAll(".filter-item").forEach((item) => {
      item.setAttribute("role", "button");
      item.tabIndex = 0;
      const choose = () => {
        document.querySelectorAll(".filter-item").forEach((entry) => entry.classList.remove("active"));
        item.classList.add("active");
        applyCategory(item.querySelector("span")?.textContent.trim() || "All");
      };
      item.addEventListener("click", choose);
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          choose();
        }
      });
    });

    document.getElementById("sort-select")?.addEventListener("change", (event) => {
      const sorted = cards().sort((a, b) => {
        const aPrice = parsePrice(a.querySelector(".product-card-price")?.textContent);
        const bPrice = parsePrice(b.querySelector(".product-card-price")?.textContent);
        return event.target.value === "price-low" ? aPrice - bPrice
          : event.target.value === "price-high" ? bPrice - aPrice
            : event.target.value === "newest" ? Number(b.querySelector(".sale-tag") !== null) - Number(a.querySelector(".sale-tag") !== null)
              : 0;
      });
      sorted.forEach((card) => grid.append(card));
    });

    [["view-grid", "grid"], ["view-list", "list"]].forEach(([id, mode]) => {
      document.getElementById(id)?.addEventListener("click", () => {
        document.querySelectorAll(".view-btn").forEach((button) => button.classList.remove("active"));
        document.getElementById(id).classList.add("active");
        grid.style.gridTemplateColumns = mode === "list" ? "1fr" : "";
      });
    });

    document.querySelectorAll(".hue-swatch").forEach((swatch) => swatch.addEventListener("click", () => {
      document.querySelectorAll(".hue-swatch").forEach((item) => item.classList.remove("active"));
      swatch.classList.add("active");
    }));
    document.querySelectorAll(".material-item").forEach((item) => {
      item.tabIndex = 0;
      item.addEventListener("click", () => item.classList.toggle("active"));
    });
  }

  function bindAdmin() {
    const table = document.querySelector(".data-table");
    const selectAllControls = [...document.querySelectorAll("#select-all, #th-select-all, #order-select-all")];
    const bulkBox = document.getElementById("bulk-actions");
    const rowChecks = () => [...(table?.querySelectorAll("tbody input[type=checkbox]") || [])];
    const updateSelection = () => {
      const selected = rowChecks().filter((checkbox) => checkbox.checked);
      if (bulkBox) {
        bulkBox.style.display = selected.length ? "flex" : "none";
        const label = bulkBox.querySelector("label");
        if (label) label.textContent = `${selected.length} ${selected.length === 1 ? "product" : "products"} selected`;
      }
      selectAllControls.forEach((control) => {
        control.checked = rowChecks().length > 0 && selected.length === rowChecks().length;
      });
    };
    selectAllControls.forEach((control) => {
      control.addEventListener("change", () => {
        rowChecks().forEach((checkbox) => { checkbox.checked = control.checked; });
        updateSelection();
      });
    });
    rowChecks().forEach((checkbox) => checkbox.addEventListener("change", updateSelection));
    updateSelection();

    document.getElementById("btn-delete-selected")?.addEventListener("click", () => {
      const selected = rowChecks().filter((checkbox) => checkbox.checked);
      if (!selected.length) return toast("Select at least one product first.");
      if (!confirm(`Delete ${selected.length} selected product(s)?`)) return;
      selected.forEach((checkbox) => checkbox.closest("tr")?.remove());
      updateSelection();
      toast("Selected products removed from this page.");
    });

    document.getElementById("btn-add-product")?.addEventListener("click", () => {
      const name = prompt("Product name:");
      if (name === null) return;
      if (!name.trim()) return toast("Product name is required.");
      const price = Number(prompt("Price in rupees:"));
      if (!Number.isFinite(price) || price <= 0) return toast("Enter a valid product price.");
      const body = table?.querySelector("tbody");
      if (!body) return;
      const row = body.insertRow();
      row.innerHTML = `<td><input type="checkbox" aria-label="Select product"></td><td></td><td class="product-name-cell"></td><td class="sku-cell">NEW-${Date.now().toString().slice(-6)}</td><td class="price-cell"></td><td class="qty-cell">0</td><td><span class="status-badge out-of-stock">Out of Stock</span></td><td><div class="action-icons"><span class="action-icon" title="Edit" role="button" tabindex="0">Edit</span><span class="action-icon delete" title="Delete" role="button" tabindex="0">Delete</span></div></td>`;
      row.querySelector(".product-name-cell").textContent = name.trim();
      row.querySelector(".price-cell").textContent = money(price);
      row.querySelector("input").addEventListener("change", updateSelection);
      toast("Product added to the current table. Connect a backend to persist it.");
    });

    document.getElementById("filter-order-status")?.addEventListener("click", (event) => {
      const filter = event.currentTarget;
      const statuses = ["All", "Processing", "Shipped", "Delivered"];
      const current = statuses.findIndex((status) => filter.textContent.includes(status));
      const next = statuses[(current + 1) % statuses.length];
      filter.childNodes[0].textContent = `Status: ${next} `;
      document.querySelectorAll("#orders-table tbody tr").forEach((row) => {
        row.hidden = next !== "All" && !row.querySelector(".status-badge")?.textContent.includes(next);
      });
    });

    document.getElementById("filter-stock")?.addEventListener("click", (event) => {
      const filter = event.currentTarget;
      const outOfStock = filter.textContent.includes("In Stock");
      filter.childNodes[0].textContent = `Stock: ${outOfStock ? "Out of Stock" : "In Stock"} `;
      document.querySelectorAll("#products-table tbody tr").forEach((row) => {
        row.hidden = outOfStock
          ? row.querySelector(".status-badge")?.classList.contains("out-of-stock")
          : !row.querySelector(".status-badge")?.classList.contains("out-of-stock");
      });
    });

    document.getElementById("filter-category")?.addEventListener("click", (event) => {
      const filter = event.currentTarget;
      const categories = ["All Lounge", "Bedroom", "Dining", "Lighting"];
      const current = categories.findIndex((category) => filter.textContent.includes(category));
      const next = categories[(current + 1) % categories.length];
      filter.childNodes[0].textContent = `Category: ${next} `;
      const terms = {
        Bedroom: ["bed"],
        Dining: ["table"],
        Lighting: ["lamp"]
      };
      document.querySelectorAll("#products-table tbody tr").forEach((row) => {
        const termList = terms[next] || [];
        row.hidden = termList.length > 0 && !termList.some((term) => row.textContent.toLowerCase().includes(term));
      });
    });

    document.getElementById("btn-edit-category")?.addEventListener("click", () => {
      const selected = rowChecks().filter((checkbox) => checkbox.checked);
      if (!selected.length) return toast("Select at least one product first.");
      const category = prompt("Enter the category for the selected products:");
      if (!category?.trim()) return;
      selected.forEach((checkbox) => { checkbox.closest("tr").dataset.category = category.trim(); });
      toast(`Category updated for ${selected.length} selected product(s) on this page.`);
    });

    document.getElementById("btn-save-discount")?.addEventListener("click", () => {
      const form = document.getElementById("discount-form");
      const name = document.getElementById("campaign-name");
      const code = document.getElementById("discount-code");
      if (!form || !name || !code) return;
      name.required = true;
      code.required = true;
      if (!form.reportValidity()) return;
      const list = document.getElementById("campaign-list");
      const card = document.createElement("article");
      card.className = "campaign-card";
      const heading = document.createElement("div");
      heading.className = "campaign-header";
      const title = document.createElement("h3");
      title.className = "campaign-name";
      title.textContent = name.value.trim();
      const campaignCode = document.createElement("span");
      campaignCode.className = "campaign-code";
      campaignCode.textContent = code.value.trim().toUpperCase();
      heading.append(title, campaignCode);
      card.append(heading);
      list?.append(card);
      toast("Discount rule added to this page. Connect a backend to persist it.");
    });

    document.getElementById("btn-create-discount")?.addEventListener("click", () => {
      document.getElementById("campaign-name")?.focus();
      document.getElementById("discount-builder")?.scrollIntoView({ behavior: "smooth" });
    });

    document.getElementById("btn-save-settings")?.addEventListener("click", () => {
      const settings = {};
      document.querySelectorAll("#settings-content input, #settings-content select").forEach((field) => {
        if (field.id) settings[field.id] = field.value;
      });
      if (writeStorage(SETTINGS_KEY, settings)) toast("Settings saved in this browser.");
    });
    const savedSettings = readStorage(SETTINGS_KEY, {});
    Object.entries(savedSettings || {}).forEach(([id, value]) => {
      const field = document.getElementById(id);
      if (field) field.value = value;
    });
    document.getElementById("btn-cancel-settings")?.addEventListener("click", () => location.reload());

    document.querySelectorAll(".settings-nav-item").forEach((item) => {
      item.tabIndex = 0;
      item.addEventListener("click", () => {
        document.querySelectorAll(".settings-nav-item").forEach((entry) => entry.classList.remove("active"));
        item.classList.add("active");
        if (item.id !== "settings-nav-profile") toast("This settings section is not available in the current page.");
      });
    });

    document.getElementById("btn-export-csv")?.addEventListener("click", () => exportTableOrReport());
    document.getElementById("btn-export-orders")?.addEventListener("click", () => exportTableOrReport());
    document.getElementById("notification-btn")?.addEventListener("click", () => toast("You are all caught up."));
  }

  function exportTableOrReport() {
    const rows = [...document.querySelectorAll(".data-table tr")];
    let csv;
    if (rows.length) {
      csv = rows.map((row) => [...row.cells].map((cell) =>
        `"${cell.innerText.trim().replace(/"/g, '""').replace(/\s+/g, " ")}"`
      ).join(",")).join("\r\n");
    } else {
      const report = [...document.querySelectorAll(".kpi-card")].map((card) => [
        card.querySelector(".kpi-label")?.textContent.trim() || "",
        card.querySelector(".kpi-value")?.textContent.trim() || ""
      ]);
      csv = [["Metric", "Value"], ...report].map((row) => row.map((field) => `"${field.replace(/"/g, '""')}"`).join(",")).join("\r\n");
    }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `${pageName.replace(".html", "")}-report.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast("CSV report downloaded.");
  }

  function bindGlobalInteractions() {
    document.getElementById("search-input")?.addEventListener("input", (event) => {
      const query = event.target.value.trim().toLowerCase();
      const candidates = document.querySelectorAll(
        ".data-table tbody tr, #product-grid .product-card, .order-card, .category-card, .campaign-card"
      );
      candidates.forEach((item) => { item.hidden = query !== "" && !item.textContent.toLowerCase().includes(query); });
    });

    document.addEventListener("click", (event) => {
      const addButton = event.target.closest(".btn-add-cart");
      if (addButton) {
        event.preventDefault();
        addToCart(addButton);
        return;
      }

      const quantityButton = event.target.closest(".qty-btn");
      if (quantityButton) {
        const row = quantityButton.closest(".cart-item");
        const item = cart.find((entry) => entry.id === row?.dataset.productId);
        if (!item) return;
        if (quantityButton.textContent.trim() === "+") item.quantity += 1;
        else if (item.quantity > 1) item.quantity -= 1;
        else return;
        saveCart();
        return;
      }

      const removeButton = event.target.closest(".remove-btn");
      if (removeButton) {
        const row = removeButton.closest(".cart-item");
        cart = cart.filter((item) => item.id !== row?.dataset.productId);
        saveCart();
        return;
      }

      const action = event.target.closest(".action-icon");
      if (action) {
        const row = action.closest("tr");
        const campaign = action.closest(".campaign-card");
        if (action.classList.contains("delete")) {
          if (confirm("Remove this item from the current page?")) (row || campaign)?.remove();
        } else if (row?.querySelector(".product-name-cell")) {
          const nameCell = row.querySelector(".product-name-cell");
          const nextName = prompt("Product name:", nameCell.textContent.trim());
          if (nextName?.trim()) nameCell.textContent = nextName.trim();
        } else if (campaign) {
          const name = campaign.querySelector(".campaign-name");
          const nextName = prompt("Campaign name:", name?.textContent.trim() || "");
          if (nextName?.trim() && name) name.textContent = nextName.trim();
        } else if (row) {
          toast(row.querySelector(".order-id")?.textContent
            ? `Order ${row.querySelector(".order-id").textContent} selected.`
            : "This action is not available for this item.");
        }
        return;
      }

      const categoryCard = event.target.closest(".category-card");
      if (categoryCard) {
        event.preventDefault();
        const category = categoryCard.querySelector(".category-card-name")?.textContent.trim() || "";
        location.href = `client-shop.html?category=${encodeURIComponent(category)}`;
      }

      const shipping = event.target.closest(".shipping-option");
      if (shipping) {
        document.querySelectorAll(".shipping-option").forEach((option) => option.classList.remove("selected"));
        shipping.classList.add("selected");
        updateCheckoutSummary();
      }
    });

    document.querySelectorAll(".btn-social").forEach((button) => button.addEventListener("click", (event) => {
      event.preventDefault();
      toast("Social sign-in is unavailable until an authentication provider is connected.");
    }));
    document.querySelectorAll(".auth-extras a[href='#']").forEach((link) => link.addEventListener("click", (event) => {
      event.preventDefault();
      toast(/forgot password/i.test(link.textContent)
        ? "Password recovery requires a connected authentication service."
        : "Terms and privacy documents are not available in this demo.");
    }));

    document.querySelectorAll(".order-actions .btn-outline").forEach((button) => {
      button.addEventListener("click", () => window.print());
    });
    document.querySelectorAll(".order-actions .btn-dark").forEach((button) => {
      button.addEventListener("click", () => {
        const card = button.closest(".order-card");
        const name = card?.querySelector(".order-product-info h4")?.textContent.trim();
        const amount = parsePrice(card?.querySelector(".order-meta-item:nth-child(3) .order-meta-value")?.textContent);
        const image = card?.querySelector(".order-product-img")?.getAttribute("src");
        if (!name || !amount || !image) return toast("Order details are incomplete; items could not be reordered.");
        const id = slug(name);
        const existing = cart.find((item) => item.id === id);
        if (existing) existing.quantity += 1;
        else cart.push({ id, name, price: amount, quantity: 1, image });
        saveCart();
        toast("Order item added to your curated bag.");
      });
    });

    document.querySelectorAll("#shop-pagination .client-page-btn, #pagination .page-btn, #orders-pagination .page-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const group = button.parentElement;
        group.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
      });
    });
  }

  function initialize() {
    updateCartBadges();
    renderCart();
    updateCheckoutSummary();
    bindForms();
    bindShop();
    bindAdmin();
    bindGlobalInteractions();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
  else initialize();
})();
