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

    container.appendChild(label);
    container.appendChild(fileInput);
    container.appendChild(saveButton);
    container.appendChild(linkButton);
    container.appendChild(hideButton);
    container.appendChild(deleteButton); // إضافة الزر الجديد
    document.body.appendChild(container);

    // عند اختيار ملف، قم بتحديث اسم الملف المعروض
    fileInput.addEventListener('change', function() {
      label.textContent = this.files[0] ? this.files[0].name : "Choose File";
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
          } else {
            applyImageBackground(dataUrl);
            await storageSet("background", dataUrl);
            await storageSet("backgroundType", "image");
          }

          fileInput.value = '';
          label.textContent = "Choose File";
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
        } else {
          applyImageBackground(trimmed);
          await storageSet("background", trimmed);
          await storageSet("backgroundType", "image");
        }
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
      } else {
        applyImageBackground(dataUrl);
        await storageSet("background", dataUrl);
        await storageSet("backgroundType", "image");
      }
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

      // إعادة العناصر المرئية إلى حالتها الأصلية
      const avatarImg = findAvatarImg();
      if (avatarImg) {
        avatarImg.style.display = "";
      }

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
