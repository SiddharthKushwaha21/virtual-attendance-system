from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import os
import cv2
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

try:
    import face_recognition
    FACE_RECOGNITION_AVAILABLE = True
    print("✅ face_recognition loaded!")
except ImportError as e:
    FACE_RECOGNITION_AVAILABLE = False
    print(f"❌ face_recognition import failed: {e}")

app = FastAPI(title="Attendance AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    client = MongoClient(os.getenv("MONGO_URI"))
    db = client["attendance"]
    students_collection = db["students"]
    print("✅ MongoDB connected!")
except Exception as e:
    print(f"❌ MongoDB error: {e}")

def convert_image(contents):
    nparr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Image decode nahi hui!")
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    print(f"✅ Image shape: {image_rgb.shape}, dtype: {image_rgb.dtype}")
    return image_rgb

def check_liveness(image, face_location):
    try:
        top, right, bottom, left = face_location
        padding = 10
        face_region = image[
            max(0, top - padding):min(image.shape[0], bottom + padding),
            max(0, left - padding):min(image.shape[1], right + padding)
        ]

        if face_region.size == 0:
            return True, 0

        gray = cv2.cvtColor(face_region, cv2.COLOR_RGB2GRAY)
        gray = cv2.resize(gray, (64, 64))

        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()

        sobel_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        gradient_magnitude = np.sqrt(sobel_x**2 + sobel_y**2)
        texture_score = gradient_magnitude.mean()

        # Specular reflection check
        _, bright_mask = cv2.threshold(gray, 220, 255, cv2.THRESH_BINARY)
        bright_ratio = np.sum(bright_mask > 0) / (64 * 64)

        # Color variance check
        face_resized = cv2.resize(face_region, (64, 64))
        color_std = np.std(face_resized, axis=(0, 1)).mean()

        print(f"🔍 Liveness — Laplacian: {laplacian_var:.2f}, Texture: {texture_score:.2f}, Bright: {bright_ratio:.3f}, Color: {color_std:.2f}")

        is_live = (
            laplacian_var > 200 and
            texture_score > 35 and
            bright_ratio < 0.15 and
            color_std > 20
        )

        return is_live, round(texture_score, 2)

    except Exception as e:
        print(f"⚠️ Liveness check error: {e}")
        return True, 0

@app.get("/")
def root():
    return {
        "message": "AI Service chal raha hai!",
        "face_recognition": FACE_RECOGNITION_AVAILABLE
    }

# ─────────────────────────────────────────────
# Single photo register
# POST /register-face/{student_id}
# ─────────────────────────────────────────────
@app.post("/register-face/{student_id}")
async def register_face(student_id: str, file: UploadFile = File(...)):
    if not FACE_RECOGNITION_AVAILABLE:
        raise HTTPException(status_code=500, detail="face_recognition available nahi hai!")
    try:
        contents = await file.read()
        print(f"📸 File size: {len(contents)} bytes")

        image = convert_image(contents)
        face_locations = face_recognition.face_locations(image, model="hog")
        print(f"👤 Face locations: {face_locations}")

        if len(face_locations) == 0:
            raise HTTPException(status_code=400, detail="Koi face detect nahi hua! Thoda aur paas aao!")
        if len(face_locations) > 1:
            raise HTTPException(status_code=400, detail="Ek se zyada face detect hue!")

        encodings = face_recognition.face_encodings(image, known_face_locations=face_locations)
        encoding = encodings[0].tolist()

        from bson import ObjectId

        all_encodings = [encoding]

        students_collection.update_one(
            {"_id": ObjectId(student_id)},
            {"$set": {
                "faceEncoding": encoding,
                "faceEncodings": all_encodings,
                "faceImage": "registered",
                "faceCount": len(all_encodings)
            }}
        )

        return {
            "success": True,
            "message": "Face register ho gaya!",
            "student_id": student_id,
            "total_encodings": len(all_encodings)
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────────
# Multiple photos ek saath register
# POST /register-face-multiple/{student_id}
# ─────────────────────────────────────────────
@app.post("/register-face-multiple/{student_id}")
async def register_face_multiple(student_id: str, files: list[UploadFile] = File(...)):
    if not FACE_RECOGNITION_AVAILABLE:
        raise HTTPException(status_code=500, detail="face_recognition available nahi hai!")

    if len(files) < 1:
        raise HTTPException(status_code=400, detail="Kam se kam 1 photo chahiye!")
    if len(files) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 photos allowed hain!")

    try:
        from bson import ObjectId
        new_encodings = []
        failed = 0

        for i, file in enumerate(files):
            try:
                contents = await file.read()
                image = convert_image(contents)
                face_locations = face_recognition.face_locations(image, model="hog")

                if len(face_locations) == 0:
                    print(f"⚠️ Photo {i+1}: Face detect nahi hua, skip")
                    failed += 1
                    continue
                if len(face_locations) > 1:
                    print(f"⚠️ Photo {i+1}: Multiple faces, skip")
                    failed += 1
                    continue

                encodings = face_recognition.face_encodings(image, known_face_locations=face_locations)
                if encodings:
                    new_encodings.append(encodings[0].tolist())
                    print(f"✅ Photo {i+1}: Encoding nikali")
            except Exception as e:
                print(f"⚠️ Photo {i+1} error: {e}")
                failed += 1
                continue

        if len(new_encodings) == 0:
            raise HTTPException(
                status_code=400,
                detail="Kisi bhi photo mein face detect nahi hua! Saaf, seedha photo lo."
            )

        all_encodings = new_encodings

        students_collection.update_one(
            {"_id": ObjectId(student_id)},
            {"$set": {
                "faceEncoding": new_encodings[0],
                "faceEncodings": all_encodings,
                "faceImage": "registered",
                "faceCount": len(all_encodings)
            }}
        )

        return {
            "success": True,
            "message": f"{len(new_encodings)} photos register ho gayi! ({failed} skip ki gayi)",
            "student_id": student_id,
            "registered": len(new_encodings),
            "failed": failed,
            "total_encodings": len(all_encodings)
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────────
# Face recognition + Anti-Spoofing
# POST /recognize
# ─────────────────────────────────────────────
@app.post("/recognize")
async def recognize_face(file: UploadFile = File(...)):
    if not FACE_RECOGNITION_AVAILABLE:
        raise HTTPException(status_code=500, detail="face_recognition available nahi hai!")
    try:
        contents = await file.read()
        image = convert_image(contents)

        face_locations = face_recognition.face_locations(image, model="hog")
        print(f"👤 Face locations: {face_locations}")

        if len(face_locations) == 0:
            return {"success": False, "message": "Koi face detect nahi hua!"}

        # ✅ Anti-Spoofing — Liveness check
        is_live, texture_score = check_liveness(image, face_locations[0])
        print(f"🔍 Is Live: {is_live}, Texture Score: {texture_score}")

        if not is_live:
            return {
                "success": False,
                "liveness": False,
                "texture_score": texture_score,
                "message": "⚠️ Real face detect nahi hua! Photo ya screen se attendance nahi hogi."
            }

        unknown_encodings = face_recognition.face_encodings(image, known_face_locations=face_locations)

        if len(unknown_encodings) == 0:
            return {"success": False, "message": "Koi face detect nahi hua!"}

        unknown_encoding = unknown_encodings[0]

        students = list(students_collection.find(
            {"faceEncoding": {"$exists": True, "$ne": []}, "isActive": True},
            {"_id": 1, "name": 1, "rollNo": 1, "faceEncoding": 1, "faceEncodings": 1}
        ))

        if len(students) == 0:
            return {"success": False, "message": "Koi registered face nahi hai!"}

        best_match = None
        best_distance = float('inf')

        for student in students:
            encodings_list = student.get("faceEncodings", [])
            if not encodings_list and student.get("faceEncoding"):
                encodings_list = [student["faceEncoding"]]

            if not encodings_list:
                continue

            student_encodings = [np.array(enc) for enc in encodings_list]
            distances = face_recognition.face_distance(student_encodings, unknown_encoding)
            min_distance = np.min(distances)

            print(f"👤 {student['name']}: min_distance={min_distance:.3f} ({len(encodings_list)} encodings)")

            if min_distance < best_distance:
                best_distance = min_distance
                best_match = student

        if best_match is None:
            return {"success": False, "message": "Koi match nahi mila!"}

        confidence = round((1 - best_distance) * 100, 2)

        if best_distance < 0.5:
            return {
                "success": True,
                "student_id": str(best_match["_id"]),
                "name": best_match["name"],
                "rollNo": best_match["rollNo"],
                "confidence": confidence,
                "liveness": True,
                "texture_score": texture_score,
                "message": f"{best_match['name']} pehchana gaya!"
            }
        else:
            return {
                "success": False,
                "confidence": confidence,
                "message": "Face match nahi hua!"
            }
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────────
# Face count
# GET /face-count/{student_id}
# ─────────────────────────────────────────────
@app.get("/face-count/{student_id}")
async def get_face_count(student_id: str):
    try:
        from bson import ObjectId
        student = students_collection.find_one(
            {"_id": ObjectId(student_id)},
            {"faceEncodings": 1, "faceCount": 1}
        )
        if not student:
            raise HTTPException(status_code=404, detail="Student nahi mila!")

        encodings = student.get("faceEncodings", [])
        return {
            "student_id": student_id,
            "count": len(encodings),
            "max": 5
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────────
# Face reset
# DELETE /reset-face/{student_id}
# ─────────────────────────────────────────────
@app.delete("/reset-face/{student_id}")
async def reset_face(student_id: str):
    try:
        from bson import ObjectId
        students_collection.update_one(
            {"_id": ObjectId(student_id)},
            {"$set": {
                "faceEncoding": [],
                "faceEncodings": [],
                "faceCount": 0,
                "faceImage": ""
            }}
        )
        return {"success": True, "message": "Face data reset ho gaya!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────────
# Sirf face detect karo — location return karo
# POST /detect
# ─────────────────────────────────────────────
@app.post("/detect")
async def detect_face(file: UploadFile = File(...)):
    if not FACE_RECOGNITION_AVAILABLE:
        raise HTTPException(status_code=500, detail="face_recognition available nahi hai!")
    try:
        contents = await file.read()
        image = convert_image(contents)
        face_locations = face_recognition.face_locations(image, model="hog")

        if len(face_locations) == 0:
            return {"face_detected": False, "face_location": None}

        return {
            "face_detected": True,
            "face_location": list(face_locations[0])
        }
    except Exception as e:
        return {"face_detected": False, "face_location": None}