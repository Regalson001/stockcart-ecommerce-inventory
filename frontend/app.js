const API = "http://127.0.0.1:8000/api";

const $ = (selector) => document.querySelector(selector);

const state = {
  products: [],
  allProducts: [],
  cart: JSON.parse(localStorage.getItem("stockcart_cart") || "[]"),
  token: localStorage.getItem("stockcart_token") || "",
  user: JSON.parse(localStorage.getItem("stockcart_user") || "null"),
  category: "all",
  authMode: "login"
};

const money = (value) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0
  }).format(value || 0);

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));


function toast(message) {
  const element = $("#toast");

  element.textContent = message;
  element.classList.add("show");

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    element.classList.remove("show");
  }, 2800);
}


async function api(path, options = {}) {
  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),

    ...(state.token
      ? { Authorization: `Bearer ${state.token}` }
      : {}),

    ...(options.headers || {})
  };

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers
  });

  const data = response.status === 204
    ? null
    : await response.json().catch(() => ({
        detail: "Unexpected server response"
      }));

  if (!response.ok) {
    throw new Error(data?.detail || "Request failed");
  }

  return data;
}


// -------------------------
// USER SESSION
// -------------------------

function saveSession(data) {
  state.token = data.token;
  state.user = data.user;

  localStorage.setItem("stockcart_token", state.token);
  localStorage.setItem(
    "stockcart_user",
    JSON.stringify(state.user)
  );

  renderAccount();
  renderAdminVisibility();
}


function clearSession() {
  state.token = "";
  state.user = null;

  localStorage.removeItem("stockcart_token");
  localStorage.removeItem("stockcart_user");

  renderAccount();
  renderAdminVisibility();
}


function renderAccount() {
  $("#accountLabel").textContent = state.user
    ? state.user.name.split(" ")[0]
    : "Sign in";
}


function renderAdminVisibility() {
  const showAdmin = state.user?.role === "admin";

  $("#adminPanel").hidden = !showAdmin;

  if (showAdmin) {
    loadAdmin().catch((error) => toast(error.message));
  }
}


// -------------------------
// PRODUCT CATALOGUE
// -------------------------

async function loadProducts() {
  const params = new URLSearchParams();

  const search = $("#searchInput").value.trim();

  if (search) {
    params.set("q", search);
  }

  if (state.category !== "all") {
    params.set("category", state.category);
  }

  state.products = await api(`/products?${params}`);

  renderProducts();
}


function renderProducts() {
  $("#resultCount").textContent =
    `${state.products.length} products`;

  $("#productGrid").innerHTML = state.products.length
    ? state.products.map((product) => `
      <article class="product-card">

        <div class="product-image">
          <img
            src="${esc(product.image_url || "https://placehold.co/700x600?text=StockCart")}"
            alt="${esc(product.name)}"
            loading="lazy"
            onerror="this.src='https://placehold.co/700x600?text=StockCart'"
          >

          <span class="stock-pill">
            ${
              product.stock > 0
                ? `${product.stock} available`
                : "Sold out"
            }
          </span>
        </div>

        <div class="product-info">

          <div class="product-meta">
            <span>${esc(product.category)}</span>
            <span>${esc(product.sku)}</span>
          </div>

          <h3>${esc(product.name)}</h3>

          <p>${esc(product.description)}</p>

          <div class="product-bottom">

            <span class="price">
              ${money(product.price)}
            </span>

            <button
              class="add-btn"
              data-add="${product.id}"
              ${product.stock < 1 ? "disabled" : ""}
            >
              ${product.stock < 1 ? "Sold out" : "Add to bag ＋"}
            </button>

          </div>
        </div>
      </article>
    `).join("")
    : `
      <div class="empty-state">
        No products found. Try another search or category.
      </div>
    `;
}


async function loadCategories() {
  const categories = await api("/categories");

  $("#categoryFilters").innerHTML = `
    <button
      class="filter ${state.category === "all" ? "active" : ""}"
      data-category="all"
    >
      All
    </button>

    ${categories.map((category) => `
      <button
        class="filter ${state.category === category ? "active" : ""}"
        data-category="${esc(category)}"
      >
        ${esc(category)}
      </button>
    `).join("")}
  `;
}


// -------------------------
// SHOPPING CART
// -------------------------

function persistCart() {
  localStorage.setItem(
    "stockcart_cart",
    JSON.stringify(state.cart)
  );

  renderCart();
}


function cartLines() {
  return state.cart.map((line) => ({
    ...line,
    product: state.allProducts.find(
      (product) => product.id === line.product_id
    )
  })).filter((line) => line.product);
}


function renderCart() {
  const count = state.cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  $("#cartCount").textContent = count;
  $("#drawerCount").textContent = `(${count})`;

  const lines = cartLines();

  const total = lines.reduce(
    (sum, line) => sum + line.product.price * line.quantity,
    0
  );

  $("#cartSubtotal").textContent = money(total);

  $("#cartItems").innerHTML = lines.length
    ? lines.map((line) => `
      <div class="cart-line">

        <img
          src="${esc(line.product.image_url)}"
          alt="${esc(line.product.name)}"
        >

        <div>
          <h4>${esc(line.product.name)}</h4>

          <p>${money(line.product.price)} each</p>

          <div class="qty-controls">

            <button
              data-qty="${line.product_id}"
              data-delta="-1"
              aria-label="Decrease quantity"
            >
              −
            </button>

            <span>${line.quantity}</span>

            <button
              data-qty="${line.product_id}"
              data-delta="1"
              aria-label="Increase quantity"
            >
              ＋
            </button>

          </div>
        </div>

        <strong>
          ${money(line.product.price * line.quantity)}
        </strong>

      </div>
    `).join("")
    : `
      <div class="empty-state">
        Your bag is waiting for something good.
      </div>
    `;
}


function addToCart(id) {
  const product = state.allProducts.find(
    (item) => item.id === id
  );

  if (!product) return;

  if (product.stock < 1) {
    return toast("This product is currently out of stock");
  }

  const line = state.cart.find(
    (item) => item.product_id === id
  );

  if (line) {
    if (line.quantity >= product.stock) {
      return toast("You've reached the available stock");
    }

    line.quantity++;
  } else {
    state.cart.push({
      product_id: id,
      quantity: 1
    });
  }

  persistCart();

  toast(`${product.name} added to your bag`);
}


function changeQty(id, delta) {
  const line = state.cart.find(
    (item) => item.product_id === id
  );

  const product = state.allProducts.find(
    (item) => item.id === id
  );

  if (!line) return;

  line.quantity += delta;

  if (line.quantity <= 0) {
    state.cart = state.cart.filter(
      (item) => item.product_id !== id
    );
  } else if (product && line.quantity > product.stock) {
    line.quantity = product.stock;
    toast("Quantity adjusted to available stock");
  }

  persistCart();
}


// -------------------------
// MODAL MANAGEMENT
// -------------------------

function openModal(id) {
  $("#" + id).hidden = false;
}


function closeModal(id) {
  $("#" + id).hidden = true;
}


function openAuth() {
  state.authMode = "login";

  updateAuthForm();

  openModal("authModal");
}


function updateAuthForm() {
  $("#authTitle").textContent =
    state.authMode === "login"
      ? "Sign in"
      : "Create your account";

  $("#authSubmit").textContent =
    state.authMode === "login"
      ? "Sign in"
      : "Create account";

  $("#nameField").hidden =
    state.authMode === "login";

  $("#nameField input").required =
    state.authMode === "register";

  $("#authSwitch").innerHTML =
    state.authMode === "login"
      ? 'New here? <button class="text-btn" id="switchAuth">Create an account</button>'
      : 'Already registered? <button class="text-btn" id="switchAuth">Sign in</button>';
}


// -------------------------
// CUSTOMER ORDER HISTORY
// -------------------------

async function loadOrders() {
  if (!state.user) {
    $("#ordersList").innerHTML =
      '<p class="muted">Sign in to view your orders.</p>';

    return;
  }

  const orders = await api("/orders");

  $("#ordersList").innerHTML = orders.length
    ? orders.map((order) => `
      <article class="order-card">

        <div>
          <h3>
            Order #SC-${String(order.id).padStart(5, "0")}
          </h3>

          <p>
            ${new Date(order.created_at).toLocaleString()}
            ·
            ${order.items.map((item) =>
              `${item.quantity}× ${esc(item.product_name)}`
            ).join(", ")}
          </p>
        </div>

        <div>
          <strong>${money(order.total)}</strong>
          <span class="status">${esc(order.status)}</span>
        </div>

      </article>
    `).join("")
    : `
      <div class="empty-state">
        No orders yet. Your first order will appear here.
      </div>
    `;
}


// -------------------------
// ADMIN DASHBOARD
// -------------------------

async function loadAdmin() {
  const [summary, products, orders] = await Promise.all([
    api("/admin/summary"),
    api("/products"),
    api("/admin/orders")
  ]);

  state.allProducts = products;

  $("#adminStats").innerHTML = [
    ["Products", summary.products],
    ["Orders", summary.orders],
    ["Revenue", money(summary.revenue)],
    ["Low stock", summary.low_stock]
  ].map(([label, value]) => `
    <div class="stat-card">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");

  $("#inventoryTable").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>SKU</th>
          <th>Price</th>
          <th>Stock</th>
          <th>Action</th>
        </tr>
      </thead>

      <tbody>
        ${products.map((product) => `
          <tr>
            <td>${esc(product.name)}</td>
            <td>${esc(product.sku)}</td>
            <td>${money(product.price)}</td>
            <td class="${product.stock <= 5 ? "low" : ""}">
              ${product.stock}
            </td>
            <td>
              <button
                class="table-action"
                data-edit="${product.id}"
              >
                Edit
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  $("#adminOrders").innerHTML = orders.length
    ? orders.slice(0, 8).map((order) => `
      <div class="order-card">

        <div>
          <h3>
            #SC-${order.id} · ${esc(order.customer_name)}
          </h3>

          <p>
            ${money(order.total)}
            ·
            ${new Date(order.created_at).toLocaleDateString()}
          </p>
        </div>

        <select data-status="${order.id}">
          ${[
            "Processing",
            "Shipped",
            "Delivered",
            "Cancelled"
          ].map((status) => `
            <option ${status === order.status ? "selected" : ""}>
              ${status}
            </option>
          `).join("")}
        </select>

      </div>
    `).join("")
    : '<p class="muted">No orders yet.</p>';
}


// -------------------------
// PRODUCT FORM
// -------------------------

function openProductForm(product = null) {
  const form = $("#productForm");

  form.reset();

  form.elements.id.value = product?.id || "";

  [
    "name",
    "sku",
    "category",
    "price",
    "stock",
    "image_url",
    "description"
  ].forEach((key) => {
    form.elements[key].value = product?.[key] ?? "";
  });

  $("#productModalTitle").textContent =
    product ? "Edit product" : "Add product";

  openModal("productModal");
}


// -------------------------
// REFRESH APPLICATION DATA
// -------------------------

async function refreshEverything() {
  const products = await api("/products");

  state.allProducts = products;

  await loadProducts();
  await loadCategories();

  renderCart();

  if (state.user) {
    await loadOrders();
  }

  renderAdminVisibility();
}


// -------------------------
// EVENT LISTENERS
// -------------------------

$("#productGrid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");

  if (button) {
    addToCart(Number(button.dataset.add));
  }
});


$("#categoryFilters").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-category]");

  if (!button) return;

  state.category = button.dataset.category;

  await loadCategories();
  await loadProducts();
});


let searchTimer;

$("#searchInput").addEventListener("input", () => {
  clearTimeout(searchTimer);

  searchTimer = setTimeout(() => {
    loadProducts().catch((error) => toast(error.message));
  }, 250);
});


$("#cartBtn").addEventListener("click", () => {
  openModal("cartOverlay");
});


$("#cartItems").addEventListener("click", (event) => {
  const button = event.target.closest("[data-qty]");

  if (button) {
    changeQty(
      Number(button.dataset.qty),
      Number(button.dataset.delta)
    );
  }
});


$("#accountBtn").addEventListener("click", () => {
  if (state.user) {
    $("#orders").scrollIntoView({ behavior: "smooth" });
  } else {
    openAuth();
  }
});


document.addEventListener("click", (event) => {
  const closeButton = event.target.closest("[data-close]");

  if (closeButton) {
    closeModal(closeButton.dataset.close);
  }

  if (event.target.classList.contains("modal-wrap")) {
    event.target.hidden = true;
  }

  if (event.target.id === "switchAuth") {
    state.authMode =
      state.authMode === "login" ? "register" : "login";

    updateAuthForm();
  }
});


// -------------------------
// LOGIN AND REGISTRATION
// -------------------------

$("#authForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const body = Object.fromEntries(formData);

  try {
    const data = await api(`/auth/${state.authMode}`, {
      method: "POST",
      body: JSON.stringify(body)
    });

    saveSession(data);

    closeModal("authModal");

    toast(`Welcome, ${data.user.name}`);

    await loadOrders();

  } catch (error) {
    toast(error.message);
  }
});


$("#logoutBtn").addEventListener("click", () => {
  clearSession();

  toast("Signed out");
});


// -------------------------
// CHECKOUT
// -------------------------

$("#checkoutBtn").addEventListener("click", () => {
  if (!state.cart.length) {
    return toast("Your bag is empty");
  }

  if (!state.user) {
    closeModal("cartOverlay");
    openAuth();

    return toast("Sign in before checkout");
  }

  const total = cartLines().reduce(
    (sum, line) =>
      sum + line.product.price * line.quantity,
    0
  );

  $("#checkoutTotal").textContent = money(total);

  closeModal("cartOverlay");

  openModal("checkoutModal");
});


$("#checkoutForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const body = Object.fromEntries(
    new FormData(event.currentTarget)
  );

  body.items = state.cart.map((item) => ({
    product_id: item.product_id,
    quantity: item.quantity
  }));

  try {
    const order = await api("/orders", {
      method: "POST",
      body: JSON.stringify(body)
    });

    state.cart = [];

    persistCart();

    closeModal("checkoutModal");

    event.currentTarget.reset();

    toast(`Order #${order.id} placed successfully`);

    await refreshEverything();

    $("#orders").scrollIntoView({
      behavior: "smooth"
    });

  } catch (error) {
    toast(error.message);

    await refreshEverything();
  }
});


$("#refreshOrders").addEventListener("click", () => {
  loadOrders().catch((error) => toast(error.message));
});


// -------------------------
// ADMIN PRODUCT MANAGEMENT
// -------------------------

$("#addProductBtn").addEventListener("click", () => {
  openProductForm();
});


$("#inventoryTable").addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit]");

  if (!button) return;

  const product = state.allProducts.find(
    (item) => item.id === Number(button.dataset.edit)
  );

  if (product) {
    openProductForm(product);
  }
});


$("#productForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;

  const data = Object.fromEntries(
    new FormData(form)
  );

  const id = data.id;

  delete data.id;

  data.price = Number(data.price);
  data.stock = Number(data.stock);

  try {
    await api(
      id ? `/products/${id}` : "/products",
      {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(data)
      }
    );

    closeModal("productModal");

    toast("Product saved successfully");

    await refreshEverything();

  } catch (error) {
    toast(error.message);
  }
});


// -------------------------
// ADMIN ORDER STATUS
// -------------------------

$("#adminOrders").addEventListener("change", async (event) => {
  const id = event.target.dataset.status;

  if (!id) return;

  try {
    await api(`/admin/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status: event.target.value
      })
    });

    toast("Order status updated");

    await loadAdmin();
    await refreshEverything();

  } catch (error) {
    toast(error.message);
  }
});


// -------------------------
// APPLICATION INITIALIZATION
// -------------------------

(async function init() {
  renderAccount();
  renderCart();

  try {
    await refreshEverything();

    if (state.token) {
      try {
        const user = await api("/auth/me");

        state.user = user;

        localStorage.setItem(
          "stockcart_user",
          JSON.stringify(user)
        );

        renderAccount();
        renderAdminVisibility();

        await loadOrders();

      } catch {
        clearSession();
      }
    }

  } catch (error) {
    $("#productGrid").innerHTML = `
      <div class="empty-state">
        Cannot connect to StockCart API.
        Start the Python backend, then refresh this page.
        <br><br>
        ${esc(error.message)}
      </div>
    `;
  }
})();
