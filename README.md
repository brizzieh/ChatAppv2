# 💬 ChatAppv2

ChatAppv2 is a Python-based web chat application designed for real-time communication. Built with Django, it supports user registration, login, profile management, and real-time messaging.

---

## 🚀 Features

- User Authentication (Login, Signup, Logout)
- Real-time Chat
- Profile Customization
- Admin Panel
- Message History

---

## ⚙️ Tech Stack

- Python 3.x
- Django 5.x
- SQLite/MySQL/PostgreSQL
- HTML/CSS + Tailwind

---

## 📦 Installation

Follow these steps to set up ChatAppv2 on your local machine:

### 1. 🐍 Clone the Repository

```bash
git clone https://github.com/brizzieh/ChatAppv2.git
cd ChatAppv2
```

### 2. 📁 Create a Virtual Environment

Windows:
```bash
python -m venv env
env\Scripts\activate
```

Linux/macOS:
```bash
python3 -m venv env
source env/bin/activate
```

### 3. 📥 Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. ⚙️ Set Up Environment Variables

If you use `.env`, copy the example:

```bash
cp .env.example .env
```

Then configure the values as needed.

### 5. 🧩 Apply Migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

### 6. 👤 Create Superuser

```bash
python manage.py createsuperuser
```

### 7. 🖼️ Collect Static Files (Production)

```bash
python manage.py collectstatic
```

> Skip this step if in development.

### 8. 🏃 Run the Server

```bash
python manage.py runserver
```

Visit: `http://127.0.0.1:8000`

---

## 💡 Extra Commands

- **Deactivate Virtual Env**
```bash
deactivate
```

- **Run Tests**
```bash
python manage.py test
```

- **Lint with flake8**
```bash
flake8 .
```

---

## 🧠 Contribution Guide

1. Fork the repo
2. Create a new branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m 'add my feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit a pull request

---

## 📄 License

MIT License – see `LICENSE` file for details.

---

## 📬 Contact

Made with ❤️ by [Your Name](mailto:your.email@example.com)  
GitHub: [@yourusername](https://github.com/yourusername)