# StyleHub MongoDB Clothing Website

Full local e-commerce project with React, Node.js, Express, MongoDB, JWT auth, user register/sign in, cart, wishlist, and admin product add/edit/delete.

## Run

```bash
docker compose up --build
```

Open:

```text
http://localhost:5173
```

API:

```text
http://localhost:5000
```

## Admin login

```text
admin@stylehub.com
admin123
```

## Customer login

```text
customer@stylehub.com
customer123
```

## Reset database

```bash
docker compose down -v
docker compose up --build
```


---

## Updated Product Categories

This version includes additional products in every category:

- Women
- Men
- Accessories

If you already ran the old version before, MongoDB may still contain the old seeded data in the Docker volume. To load the new products, reset the database once:

```bash
docker compose down -v
docker compose up --build
```

This removes the old MongoDB volume and reseeds the database with the updated products.
