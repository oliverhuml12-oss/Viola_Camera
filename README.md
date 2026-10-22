# Viola_Camera

Camera check page for Viola (step 3 of 5 in the test flow). It asks the browser for camera and microphone access, confirms the front camera delivers a live video track, then switches the camera off again. Nothing is recorded or stored.

## Features

- Czech, Slovak and English UI; picks the browser language and falls back to Czech
- Clear states: idle, waiting for permission, success, failure
- Specific failure messages for blocked permission (with iPhone and Chrome hints), no camera found, camera in use by another app, and unsupported browser
- Light and dark mode, reduced-motion support

## Usage

Open `camera-check.html` in a browser. Camera access only works in a secure context, so serve it over HTTPS (or from `localhost` while developing):

```sh
python3 -m http.server 8000
# then open http://localhost:8000/camera-check.html
```

## Notes

- Brand colours in the `:root` tokens are placeholders; replace them with the exact Viola colours.
- The "Continue" button currently only shows a mock note where the next test step would go.
