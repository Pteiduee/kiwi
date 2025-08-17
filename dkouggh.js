const site = window.location.href;
if (site.includes("https://www.roblox.com/my/avatar") || site.includes("https://web.roblox.com/my/avatar")) {
  window.addEventListener('DOMContentLoaded', async () => {
    // helpers for storage and DOM
    const hasChromeStorage = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
    const storageGet = (key) => new Promise((resolve) => {
      if (!hasChromeStorage) {
        resolve(localStorage.getItem(key));
      } else {
        chrome.storage.local.get([key], (res) => resolve(res[key] ?? null));
      }
    });
    const storageSet = (key, value) => new Promise((resolve) => {
      if (!hasChromeStorage) {
        localStorage.setItem(key, value);
        resolve();
      } else {
        chrome.storage.local.set({ [key]: value }, () => resolve());
      }
    });
    const storageRemove = (key) => new Promise((resolve) => {
      if (!hasChromeStorage) {
        localStorage.removeItem(key);
        resolve();
      } else {
        chrome.storage.local.remove([key], () => resolve());
      }
    });
    const findAvatarImg = () => {
      const selectors = [
        ".avatar-upsell .part1 .avatar-thumbnail-upsell img",
        ".avatar-thumbnail-upsell img",
        ".avatar-upsell img",
        ".avatar-card img",
        "img[src*='avatar']"
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      return null;
    };
    const findBackgroundContainer = () => {
      const selectors = [
        ".avatar-back",
        ".avatar-upsell .content"
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      return null;
    };
    const ensureOverlayStyles = () => {
      if (document.getElementById('rbx-bgoverlay-css')) return;
      const style = document.createElement('style');
      style.id = 'rbx-bgoverlay-css';
      style.textContent = `
        .rbx-bgoverlay-container { position: relative !important; overflow: hidden !important; background: none !important; background-color: transparent !important; }
        #rbx-bgvideo.rbx-bgoverlay-element,
        #rbx-bgimage.rbx-bgoverlay-element { position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; object-fit: cover !important; pointer-events: none !important; background: none !important; z-index: 0 !important; }
        .rbx-bgoverlay-container > *:not(#rbx-bgvideo):not(#rbx-bgimage) { position: relative; z-index: 1; }
        .avatar-back,
        .avatar-upsell .content { background: none !important; background-color: transparent !important; }
        .avatar-back::before,
        .avatar-upsell .content::before,
        .avatar-back::after,
        .avatar-upsell .content::after { background: none !important; background-color: transparent !important; pointer-events: none !important; }
      `;
      document.head.appendChild(style);
    };
    const clearBackgroundElements = () => {
      const bgStyleElement = document.getElementById("bgimage");
      if (bgStyleElement) bgStyleElement.remove();
      const video = document.getElementById('rbx-bgvideo');
      if (video) video.remove();
      const img = document.getElementById('rbx-bgimage');
      if (img) img.remove();
      document.querySelectorAll('.rbx-bgvideo-container, .rbx-bgoverlay-container').forEach(c => c.classList.remove('rbx-bgvideo-container', 'rbx-bgoverlay-container'));
      const overlayCss = document.getElementById('rbx-bgoverlay-css');
      if (overlayCss) overlayCss.remove();
      const legacyVideoCss = document.getElementById('rbx-bgvideo-css');
      if (legacyVideoCss) legacyVideoCss.remove();
    };

    // New helpers to apply visual settings on media
    const getBackgroundMediaElement = () => document.getElementById('rbx-bgvideo') || document.getElementById('rbx-bgimage');

    async function applyVisualSettings() {
      try {
        const storedFit = (await storageGet("backgroundObjectFit")) || "cover";
        const storedBrightnessStr = await storageGet("backgroundBrightness");
        const storedBrightness = storedBrightnessStr ? parseFloat(storedBrightnessStr) : 1;

        const mediaEl = getBackgroundMediaElement();
        if (mediaEl) {
          mediaEl.style.objectFit = storedFit;
          mediaEl.style.filter = `brightness(${isFinite(storedBrightness) ? storedBrightness : 1})`;
        }

        // Fallback mapping for CSS background case
        const bgContainer = document.querySelector('.avatar-back') || document.querySelector('.avatar-upsell .content');
        if (bgContainer && bgContainer.style && bgContainer.style.backgroundImage) {
          let bgSizeValue = "cover";
          if (storedFit === "contain") bgSizeValue = "contain";
          else if (storedFit === "fill") bgSizeValue = "100% 100%";
          bgContainer.style.backgroundSize = bgSizeValue;
        }
      } catch {}
    }

    async function applyVideoPausedState(pauseButtonEl) {
      const paused = await storageGet("videoPaused");
      const videoEl = document.getElementById("rbx-bgvideo");
      if (!videoEl) return;
      if (paused === "true") {
        try { videoEl.pause(); } catch {}
        if (pauseButtonEl) pauseButtonEl.textContent = "Play Video";
      } else {
        if (typeof videoEl.play === "function") { videoEl.play().catch(() => {}); }
        if (pauseButtonEl) pauseButtonEl.textContent = "Pause Video";
      }
    }

    const restoreDefaultBackground = () => {
      const targets = [];
      const back = document.querySelector('.avatar-back');
      if (back) targets.push(back);
      const upsell = document.querySelector('.avatar-upsell .content');
      if (upsell) targets.push(upsell);
      targets.forEach((el) => {
        el.style.removeProperty('background-image');
        el.style.removeProperty('background-size');
        el.style.removeProperty('background-position');
        el.style.removeProperty('background-repeat');
        el.style.removeProperty('background');
        el.style.removeProperty('background-color');
        el.classList.remove('rbx-bgvideo-container', 'rbx-bgoverlay-container');
      });
    };
    const applyImageBackground = (dataUrl) => {
      // إزالة النمط القديم
      const oldStyle = document.getElementById("bgimage");
      if (oldStyle) oldStyle.remove();
      // إزالة الفيديو القديم إن وجد
      const oldVideo = document.getElementById('rbx-bgvideo');
      if (oldVideo) oldVideo.remove();
      document.querySelectorAll('.rbx-bgvideo-container, .rbx-bgoverlay-container').forEach(c => c.classList.remove('rbx-bgvideo-container', 'rbx-bgoverlay-container'));

      // Try overlay element approach for more reliability
      ensureOverlayStyles();
      const container = findBackgroundContainer();
      if (container) {
        container.classList.add('rbx-bgoverlay-container');
        let imgEl = document.getElementById('rbx-bgimage');
        if (!imgEl) {
          imgEl = document.createElement('img');
          imgEl.id = 'rbx-bgimage';
          imgEl.className = 'rbx-bgoverlay-element';
        }
        imgEl.src = dataUrl;
        container.prepend(imgEl);
        // Apply current visual settings on next tick
        setTimeout(() => { applyVisualSettings(); }, 0);
        return;
      }

      const newStyle = document.createElement("style");
      newStyle.id = "bgimage";
      newStyle.textContent = `
                        .avatar-back {
                            background: none !important;
                            background-color: transparent !important;
                            background-image: url('${dataUrl}') !important;
                            background-size: cover !important;
                            background-position: center center !important;
                            background-repeat: no-repeat !important;
                        }
                        .avatar-upsell .content {
                            background: none !important;
                            background-color: transparent !important;
                            background-image: url('${dataUrl}') !important;
                            background-size: cover !important;
                            background-position: center center !important;
                            background-repeat: no-repeat !important;
                        }
                        .avatar-back::before,
                        .avatar-upsell .content::before,
                        .avatar-back::after,
                        .avatar-upsell .content::after {
                            background: none !important;
                            background-color: transparent !important;
                            pointer-events: none !important;
                        }`;
      document.head.appendChild(newStyle);
      // Apply settings even in fallback case
      setTimeout(() => { applyVisualSettings(); }, 0);
    };

    const preloadImage = (src) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
    });
    let videoContainerObserver = null;
    const applyVideoBackground = (dataUrl) => {
      ensureOverlayStyles();
      const doInject = () => {
        const container = findBackgroundContainer();
        if (!container) return false;
        container.classList.add('rbx-bgoverlay-container');
        const oldStyle = document.getElementById("bgimage");
        if (oldStyle) oldStyle.remove();
        let video = document.getElementById('rbx-bgvideo');
        if (video && video.parentElement !== container) {
          video.remove();
          video = null;
        }
        if (!video) {
          video = document.createElement('video');
          video.id = 'rbx-bgvideo';
          video.className = 'rbx-bgoverlay-element';
          video.autoplay = true;
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          video.setAttribute('playsinline', '');
          video.setAttribute('muted', '');
          video.setAttribute('autoplay', '');
          video.setAttribute('loop', '');
        }
        video.src = dataUrl;
        container.prepend(video);
        // attempt to play; ignore failures
        if (typeof video.play === 'function') {
          video.play().catch(() => {});
        }
        // Apply visual settings and paused state after insertion
        setTimeout(() => { applyVisualSettings(); applyVideoPausedState(); }, 0);
        return true;
      };

      if (!doInject()) {
        if (videoContainerObserver) videoContainerObserver.disconnect();
        videoContainerObserver = new MutationObserver(() => {
          if (doInject()) {
            videoContainerObserver.disconnect();
            videoContainerObserver = null;
          }
        });
        videoContainerObserver.observe(document.documentElement, { childList: true, subtree: true });
      }
    };

    // إذا كانت الخلفية محفوظة في storage، قم بتعيينها عند تحميل الصفحة
    const existingBackground = await storageGet("background");
    const existingType = (await storageGet("backgroundType")) || (existingBackground ? "image" : null);
    if (existingBackground && existingType) {
      if (existingType === 'video') {
        applyVideoBackground(existingBackground);
      } else {
        applyImageBackground(existingBackground);
      }
    }

    // CSS لتصميم الأزرار
    const customStyles = document.createElement('style');
    customStyles.textContent = `
            .custom-file-upload {
                display: flex;
                flex-direction: row;
                justify-content: center;
                align-items: center;
                gap: 10px;
                margin: 20px;
            }
            .custom-button {
                padding: 8px 16px;
                background-color: #007bff;
                color: #fff;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                font-weight: bold;
                cursor: pointer;
                transition: background-color 0.3s ease, transform 0.2s ease;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            .custom-button:hover {
                background-color: #0056b3;
                transform: translateY(-1px);
            }
            .custom-button:active {
                background-color: #004085;
                transform: translateY(0);
            }
            .custom-file-label {
                padding: 6px 12px;
                background-color: #6c757d;
                color: #fff;
                border-radius: 6px;
                font-size: 12px;
                font-weight: bold;
                cursor: pointer;
                transition: background-color 0.3s ease;
            }
            .custom-file-label:hover {
                background-color: #5a6268;
            }
            .custom-file-label:active {
                background-color: #495057;
            }
            .custom-select {
                padding: 6px 10px;
                border-radius: 6px;
                border: 1px solid rgba(255,255,255,.2);
                background: #2b2b2b;
                color: #fff;
                font-size: 12px;
            }
            .custom-range {
                width: 140px;
                accent-color: #007bff;
            }
            .toolbar-text {
                color: #fff;
                font-size: 12px;
                opacity: .85;
            }
            /* Mobile toolbar improvements */
            @media (max-width: 768px) {
                .custom-file-upload {
                    position: fixed;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    margin: 0;
                    padding: 8px calc(8px + env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) calc(8px + env(safe-area-inset-left));
                    background: rgba(28,28,30,.95);
                    backdrop-filter: saturate(1.1) blur(6px);
                    z-index: 2147483647;
                    overflow-x: auto;
                    flex-wrap: nowrap;
                }
                .custom-file-upload .custom-button,
                .custom-file-upload .custom-file-label,
                .custom-file-upload .custom-select {
                    flex: 0 0 auto;
                }
                .custom-range { width: 120px; }
            }
            #rbx-ui-toggle {
                position: fixed;
                right: 12px;
                bottom: calc(68px + env(safe-area-inset-bottom));
                z-index: 2147483647;
                background-color: #007bff;
                color: #fff;
                border: none;
                border-radius: 20px;
                padding: 10px 12px;
                font-size: 12px;
                font-weight: bold;
                box-shadow: 0 2px 6px rgba(0,0,0,.25);
            }
            @media (min-width: 769px) {
                #rbx-ui-toggle { bottom: 12px; }
            }
        `;
    document.head.appendChild(customStyles);

    // إنشاء الحاوية للأزرار
    const container = document.createElement("div");
    container.className = "custom-file-upload";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*,video/*";
    fileInput.id = "backgroundFile";
    fileInput.style.display = "none";

    const label = document.createElement("label");
    label.htmlFor = "backgroundFile";
    label.className = "custom-file-label";
    label.textContent = "Choose File";

    const saveButton = document.createElement("button");
    saveButton.id = "saveBackgroundButton";
    saveButton.textContent = "Save New Background";
    saveButton.className = "custom-button";

    const linkButton = document.createElement("button");
    linkButton.id = "useLinkButton";
    linkButton.textContent = "Use Link (URL)";
    linkButton.className = "custom-button";

    const hideButton = document.createElement("button");
    hideButton.id = "hideAvatarButton";
    hideButton.textContent = "Hide Avatar";
    hideButton.className = "custom-button";

    // إضافة زر "Delete Modifications"
    const deleteButton = document.createElement("button");
    deleteButton.id = "deleteModificationsButton";
    deleteButton.textContent = "Delete Modifications";
    deleteButton.className = "custom-button";

    // New controls: object-fit selector, brightness slider, video pause button
    const fitSelect = document.createElement("select");
    fitSelect.id = "fitSelect";
    fitSelect.className = "custom-select";
    [
      { v: 'cover', t: 'Fit: Cover' },
      { v: 'contain', t: 'Fit: Contain' },
      { v: 'fill', t: 'Fit: Fill' }
    ].forEach(({ v, t }) => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = t; fitSelect.appendChild(opt);
    });

    const brightnessText = document.createElement('span');
    brightnessText.className = 'toolbar-text';
    brightnessText.textContent = 'Brightness';

    const brightnessRange = document.createElement("input");
    brightnessRange.type = "range";
    brightnessRange.min = "0.3";
    brightnessRange.max = "1.5";
    brightnessRange.step = "0.01";
    brightnessRange.value = "1";
    brightnessRange.id = "brightnessRange";
    brightnessRange.className = "custom-range";

    const pauseButton = document.createElement("button");
    pauseButton.id = "pauseVideoButton";
    pauseButton.textContent = "Pause Video";
    pauseButton.className = "custom-button";
    pauseButton.style.display = "none";

    container.appendChild(label);
    container.appendChild(fileInput);
    container.appendChild(saveButton);
    container.appendChild(linkButton);
    container.appendChild(hideButton);
    container.appendChild(deleteButton); // إضافة الزر الجديد
    container.appendChild(fitSelect);
    container.appendChild(brightnessText);
    container.appendChild(brightnessRange);
    container.appendChild(pauseButton);

    const minimizeBtn = document.createElement('button');
    minimizeBtn.id = 'rbx-ui-min';
    minimizeBtn.textContent = 'Hide Toolbar';
    minimizeBtn.className = 'custom-button';
    container.appendChild(minimizeBtn);

    document.body.appendChild(container);

    // Floating toggle button for collapsing/expanding toolbar (mobile-friendly)
    const toolbarToggle = document.createElement('button');
    toolbarToggle.id = 'rbx-ui-toggle';
    toolbarToggle.textContent = 'Toolbar';
    document.body.appendChild(toolbarToggle);

    minimizeBtn.addEventListener('click', async () => {
      container.style.display = 'none';
      toolbarToggle.style.display = '';
      await storageSet('uiCollapsed', 'true');
    });

    // عند اختيار ملف، قم بتحديث اسم الملف المعروض
    fileInput.addEventListener('change', function() {
      label.textContent = this.files[0] ? this.files[0].name : "Choose File";
    });

    // Initialize control values from storage
    (async () => {
      const savedFit = (await storageGet("backgroundObjectFit")) || 'cover';
      fitSelect.value = savedFit;
      const savedBrightnessStr = await storageGet("backgroundBrightness");
      const savedBrightness = savedBrightnessStr ? parseFloat(savedBrightnessStr) : 1;
      if (isFinite(savedBrightness)) brightnessRange.value = String(savedBrightness);
      await applyVisualSettings();
      const bgType = await storageGet('backgroundType');
      pauseButton.style.display = bgType === 'video' ? '' : 'none';
      const collapsed = await storageGet('uiCollapsed');
      if (collapsed === 'true') {
        container.style.display = 'none';
        toolbarToggle.style.display = '';
      } else {
        toolbarToggle.style.display = 'none';
      }
    })();

    toolbarToggle.addEventListener('click', async () => {
      const isHidden = container.style.display === 'none';
      container.style.display = isHidden ? '' : 'none';
      toolbarToggle.style.display = isHidden ? 'none' : '';
      await storageSet('uiCollapsed', isHidden ? 'false' : 'true');
    });

    // عند النقر على زر الحفظ
    saveButton.addEventListener("click", () => {
      const file = fileInput.files[0];
      if (file) {
        const isVideo = file.type && file.type.startsWith('video/');
        // guard against large files (10MB images, 25MB videos)
        const maxSize = isVideo ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxSize) {
          alert(isVideo ? "Selected video is too large. Please choose a file under 25MB." : "Selected image is too large. Please choose a file under 10MB.");
          return;
        }
        const reader = new FileReader();
        reader.onload = async (event) => {
          const dataUrl = event.target.result;

          // إزالة أي خلفية سابقة
          clearBackgroundElements();
          if (await storageGet("background")) {
            await storageRemove("background");
          }
          if (await storageGet("backgroundType")) {
            await storageRemove("backgroundType");
          }

          if (isVideo) {
            applyVideoBackground(dataUrl);
            await storageSet("background", dataUrl);
            await storageSet("backgroundType", "video");
            setTimeout(() => { pauseButton.style.display = ''; applyVideoPausedState(pauseButton); }, 0);
          } else {
            applyImageBackground(dataUrl);
            await storageSet("background", dataUrl);
            await storageSet("backgroundType", "image");
            pauseButton.style.display = 'none';
          }

          fileInput.value = '';
          label.textContent = "Choose File";
          setTimeout(() => { applyVisualSettings(); }, 0);
        };
        reader.readAsDataURL(file);
      } else {
        alert("need to select an image file, GIF, or video!");
      }
    });

    // زر الإدخال من الرابط
    linkButton.addEventListener("click", async () => {
      const input = prompt("Enter direct image/GIF/video URL:");
      if (!input) return;
      const trimmed = input.trim();
      try {
        const u = new URL(trimmed);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          alert('Please enter a valid http(s) URL.');
          return;
        }
      } catch {
        alert('Invalid URL.');
        return;
      }

      // Ask background to fetch and convert to data URL to avoid CORS/CSP/CORP
      const fetchViaBg = () => new Promise((resolve) => {
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
          resolve({ ok: false, error: 'chrome.runtime not available' });
          return;
        }
        chrome.runtime.sendMessage({ type: 'fetchAsDataURL', url: trimmed }, (resp) => {
          resolve(resp || { ok: false, error: 'no response' });
        });
      });

      const resp = await fetchViaBg();
      if (!resp || !resp.ok) {
        // Fallback: direct use of URL if background fetch fails
        console.warn('Background fetch failed:', resp && resp.error);
        const lower = trimmed.toLowerCase();
        const videoExts = [".mp4", ".webm", ".ogg", ".ogv"];
        const isVideoByExt = videoExts.some(ext => lower.endsWith(ext));

        clearBackgroundElements();
        if (await storageGet("background")) await storageRemove("background");
        if (await storageGet("backgroundType")) await storageRemove("backgroundType");

        if (isVideoByExt) {
          applyVideoBackground(trimmed);
          await storageSet("background", trimmed);
          await storageSet("backgroundType", "video");
          setTimeout(() => { pauseButton.style.display = ''; applyVideoPausedState(pauseButton); }, 0);
        } else {
          applyImageBackground(trimmed);
          await storageSet("background", trimmed);
          await storageSet("backgroundType", "image");
          pauseButton.style.display = 'none';
        }
        setTimeout(() => { applyVisualSettings(); }, 0);
        return;
      }

      const dataUrl = resp.dataUrl;
      const ct = (resp.contentType || '').toLowerCase();
      const isVideo = ct.startsWith('video/');

      if (!isVideo) {
        try {
          await preloadImage(dataUrl);
        } catch (e) {
          alert('Failed to load the image. The link may be blocked or invalid.');
          return;
        }
      }

      clearBackgroundElements();
      if (await storageGet("background")) await storageRemove("background");
      if (await storageGet("backgroundType")) await storageRemove("backgroundType");

      if (isVideo) {
        applyVideoBackground(dataUrl);
        await storageSet("background", dataUrl);
        await storageSet("backgroundType", "video");
        setTimeout(() => { pauseButton.style.display = ''; applyVideoPausedState(pauseButton); }, 0);
      } else {
        applyImageBackground(dataUrl);
        await storageSet("background", dataUrl);
        await storageSet("backgroundType", "image");
        pauseButton.style.display = 'none';
      }
      setTimeout(() => { applyVisualSettings(); }, 0);
    });

    // عند النقر على زر إخفاء الصورة
    hideButton.addEventListener("click", async () => {
      const avatarImg = findAvatarImg();
      if (avatarImg) {
        if (avatarImg.style.display === "none") {
          avatarImg.style.display = "";
          hideButton.textContent = "Hide Avatar";
          await storageSet("hideAvatar", "false");
        } else {
          avatarImg.style.display = "none";
          hideButton.textContent = "Show Avatar";
          await storageSet("hideAvatar", "true");
        }
      }
    });

    // Brightness control events
    brightnessRange.addEventListener('input', async () => {
      const val = parseFloat(brightnessRange.value);
      await storageSet('backgroundBrightness', String(val));
      applyVisualSettings();
    });

    // Fit selector events
    fitSelect.addEventListener('change', async () => {
      await storageSet('backgroundObjectFit', fitSelect.value);
      applyVisualSettings();
    });

    // Pause/play video toggle
    pauseButton.addEventListener('click', async () => {
      const video = document.getElementById('rbx-bgvideo');
      if (!video) return;
      if (video.paused) {
        try { await video.play(); } catch {}
        pauseButton.textContent = 'Pause Video';
        await storageSet('videoPaused', 'false');
      } else {
        try { video.pause(); } catch {}
        pauseButton.textContent = 'Play Video';
        await storageSet('videoPaused', 'true');
      }
    });

    // استعادة حالة الإخفاء من storage + راقب حتى يظهر العنصر
    const applyHideState = async () => {
      const hideAvatar = await storageGet("hideAvatar");
      const avatarImg = findAvatarImg();
      if (avatarImg) {
        if (hideAvatar === "true") {
          avatarImg.style.display = "none";
          hideButton.textContent = "Show Avatar";
        } else {
          avatarImg.style.display = "";
          hideButton.textContent = "Hide Avatar";
        }
      }
    };
    await applyHideState();
    if (!findAvatarImg()) {
      const observer = new MutationObserver(() => {
        const img = findAvatarImg();
        if (img) {
          applyHideState();
          observer.disconnect();
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    // عند النقر على زر "Delete Modifications"
    deleteButton.addEventListener("click", async () => {
      clearBackgroundElements();
      restoreDefaultBackground();

      // حذف البيانات من storage
      await storageRemove("background");
      await storageRemove("backgroundType");
      await storageRemove("hideAvatar");
      await storageRemove("backgroundBrightness");
      await storageRemove("backgroundObjectFit");
      await storageRemove("videoPaused");

      // إعادة العناصر المرئية إلى حالتها الأصلية
      const avatarImg = findAvatarImg();
      if (avatarImg) {
        avatarImg.style.display = "";
      }

      // Reset UI controls
      brightnessRange.value = '1';
      fitSelect.value = 'cover';
      pauseButton.style.display = 'none';
      toolbarToggle.style.display = 'none';
      container.style.display = '';
      await storageSet('uiCollapsed', 'false');

      // إعادة تعيين نص زر "Hide Avatar"
      hideButton.textContent = "Hide Avatar";

      // Fallback: if background still not restored, reload the page
      setTimeout(() => {
        const el = document.querySelector('.avatar-back') || document.querySelector('.avatar-upsell .content');
        if (el) {
          const bg = getComputedStyle(el).getPropertyValue('background-image');
          if (!bg || bg === 'none') {
            window.location.reload();
          }
        }
      }, 100);
    });
  });
}
