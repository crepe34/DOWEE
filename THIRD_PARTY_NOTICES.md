# Third-party software

DOWEE bundles these libraries in `server/public/vendor/` so the classroom works without internet:

| Library | Version | License | Used for |
| --- | --- | --- | --- |
| [Blockly](https://github.com/google/blockly) | 10.4.3 | Apache License 2.0 | Blocks mode (also bundled inside `app/index.html` by the build, so Blocks mode works offline) |
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase | 1.4.4 | MIT | Join QR code on the teacher dashboard |
