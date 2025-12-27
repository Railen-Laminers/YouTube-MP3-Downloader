Backend – Setup Steps & Commands
  - Install Backend Dependencies
    - npm install express cors dotenv yt-search fluent-ffmpeg ffmpeg-static
    - npm install -D nodemon
    - npm install yt-dlp-exec

Install FFmpeg (Windows)
FFmpeg is required for audio conversion.
  - Tutorial (YouTube):
    - https://www.youtube.com/watch?v=mEV5ZRqaWu8
  - Make sure FFmpeg is correctly installed and available on your system.

Install yt-dlp (Windows)
  - Create tools folder
    - mkdir C:\tools\yt-dlp
    - Download yt-dlp.exe
      - curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe -o C:\tools\yt-dlp\yt-dlp.exe
    - Add yt-dlp to PATH
      - Press Win + R → type sysdm.cpl
      - Go to Advanced → Environment Variables
      - Under System Variables, select Path → Edit
        - Click New and add:
          - C:\tools\yt-dlp
          - Click OK → OK
          - Restart your terminal
    - Verify yt-dlp Installation
      - yt-dlp --version
      - If a version number appears → yt-dlp is installed correctly

Frontend – Setup
  - Install Axios
    - npm install lucide-react react-router-dom axios
    - Axios is used for API requests (search, health check, metadata).
    - File downloads still use fetch() for streaming.

Running the Application
  - Start Backend
    - npm run dev
  - Start Frontend
    - npm run dev
      
Backend runs on: http://localhost:5000
Frontend runs on: http://localhost:3000

Make sure yt-dlp and FFmpeg are correctly installed before downloading MP3 files.
