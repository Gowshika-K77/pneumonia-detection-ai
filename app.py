from flask import Flask, request, jsonify, render_template
import numpy as np
from PIL import Image
import os
import tensorflow as tf
from manual_model import create_model
import threading
import urllib.request
import time

app = Flask(__name__)

# Download model once from Hugging Face
model_path = "model/pneumonia_cnn_model.h5"

# IMPORTANT: /resolve/main/ is the direct download link (not /blob/main/)
HF_URL = "https://huggingface.co/GKvin/pneumonia-detection-ai/resolve/main/pneumonia_cnn_model.h5"

if not os.path.exists(model_path):
    os.makedirs("model", exist_ok=True)
    print("Downloading model from Hugging Face...")
    urllib.request.urlretrieve(HF_URL, model_path)
    print("Download complete!")

# Load model ONCE at startup
print("Loading model...")
model = create_model()
model.load_weights(model_path)
model.make_predict_function()
print("Model ready!")

# Keep alive — pings every 10 minutes so Render never sleeps
def keep_alive():
    while True:
        time.sleep(600)
        try:
            urllib.request.urlopen("https://meddetect-ai.onrender.com")
            print("Keep alive ping sent!")
        except:
            pass

thread = threading.Thread(target=keep_alive)
thread.daemon = True
thread.start()

def preprocess_image(image):
    image = image.convert("RGB")
    image = image.resize((224, 224))
    image = np.array(image) / 255.0
    image = np.expand_dims(image, axis=0)
    return image

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/upload')
def upload_page():
    return render_template('upload.html')

@app.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'})
    file = request.files['file']
    try:
        image = Image.open(file)
        processed = preprocess_image(image)
        prediction = model.predict(processed)
        confidence = float(prediction[0][0])
        if confidence > 0.5:
            result = "PNEUMONIA"
            display_confidence = confidence
        else:
            result = "NORMAL"
            display_confidence = 1 - confidence
        return jsonify({
            'result': result,
            'confidence': round(display_confidence * 100, 2)
        })
    except Exception as e:
        return jsonify({'error': str(e)})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=False)
