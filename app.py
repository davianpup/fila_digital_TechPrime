from flask import Flask, render_template

app = Flask(__name__)

@app.route("/") # Define a página inicial
def index():
    return render_template("index.html")

@app.route("/login") # Define a página de login
def login():
    # Removido o daqui
    return render_template("login.html")

if __name__ == "__main__":
    # Removido o daqui também
    app.run(debug=True)