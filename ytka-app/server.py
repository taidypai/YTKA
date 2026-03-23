from flask import Flask, jsonify
from flask_cors import CORS
import subprocess
import os

app = Flask(__name__)
CORS(app)

@app.route('/run-script', methods=['POST'])
def run_script():
    subprocess.Popen(
        ['cmd', '/k', 'python', '-u', r'C:\Users\Вадим\YTKA\run_app.py'],
        creationflags=subprocess.CREATE_NEW_CONSOLE,
        env={**os.environ, 'PYTHONIOENCODING': 'utf-8'}
    )
    return jsonify({'status': 'done'})

if __name__ == '__main__':
    app.run(port=5000)
