from flask import Flask, render_template, request, jsonify
import numpy as np
from PIL import Image

app = Flask(__name__)

# Load model
from manual_model import create_model
model = create_model()
model.load_weights("model/pneumonia_cnn_model.h5")

def preprocess_image(image):
    # Convert to RGB in case it's grayscale or RGBA
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
            display_confidence = confidence          # confidence of being pneumonia
        else:
            result = "NORMAL"
            display_confidence = 1 - confidence     # confidence of being normal

        return jsonify({
            'result': result,
            'confidence': round(display_confidence * 100, 2)   # send as percentage
        })

    except Exception as e:
        return jsonify({'error': str(e)})

if __name__ == "__main__":
    app.run(debug=True)