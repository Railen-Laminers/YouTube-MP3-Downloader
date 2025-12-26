📦 Backend – Setup Steps & Commands
1️⃣ Install Backend Dependencies
npm init -y
npm install express cors dotenv yt-search fluent-ffmpeg ffmpeg-static
npm install -D nodemon
npm install yt-dlp-exec

2️⃣ Install FFmpeg (Windows)

FFmpeg is required for audio conversion.

📺 Tutorial (YouTube):
https://www.youtube.com/watch?v=mEV5ZRqaWu8

⚠️ Make sure FFmpeg is correctly installed and available on your system.

3️⃣ Install yt-dlp (Windows)
Create tools folder
mkdir C:\tools\yt-dlp

Download yt-dlp.exe
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe -o C:\tools\yt-dlp\yt-dlp.exe

4️⃣ Add yt-dlp to PATH

Press Win + R → type sysdm.cpl

Go to Advanced → Environment Variables

Under System Variables, select Path → Edit

Click New and add:

C:\tools\yt-dlp


Click OK → OK

Restart your terminal

5️⃣ Verify yt-dlp Installation
yt-dlp --version


If a version number appears → ✅ yt-dlp is installed correctly

🎨 Frontend – Setup
Install Axios
npm install axios


Axios is used for API requests (search, health check, metadata).
File downloads still use fetch() for streaming.

▶️ Running the Application
Start Backend
npm run dev

Start Frontend
npm run dev

✅ Notes

Backend runs on: http://localhost:5000

Frontend runs on: http://localhost:3000

Make sure yt-dlp and FFmpeg are correctly installed before downloading MP3 files.
