Page({
  data: {
    src: '',
    cropW: 300,
    cropH: 200,
    maskTop: 0,
    maskBottom: 0,
    maskBottomHeight: 0,
    maskLeft: 0,
    maskRight: 0,
    imgWidth: 300,
    imgHeight: 200,
    x: 0,
    y: 0,
  },

  // Store coordinates globally on the page instance
  origW: 0,
  origH: 0,
  currentX: 0,
  currentY: 0,
  currentScale: 1.0,

  onLoad(options) {
    const rawSrc = decodeURIComponent(options.src || '');
    if (!rawSrc) {
      wx.showToast({ title: '图片路径无效', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    const sysInfo = wx.getSystemInfoSync();
    const W_s = sysInfo.windowWidth;
    const H_s = sysInfo.windowHeight;
    
    // Crop box width is 90% of screen width, height is calculated using 750:520 ratio
    const cropW = Math.round(W_s * 0.9);
    const cropH = Math.round(cropW * (520 / 750));
    
    const maskLeft = Math.round((W_s - cropW) / 2);
    const maskRight = maskLeft + cropW;
    const maskTop = Math.round((H_s - cropH) / 2 - 60);
    const maskBottom = maskTop + cropH;
    const maskBottomHeight = H_s - maskBottom;

    this.setData({
      cropW,
      cropH,
      maskTop,
      maskBottom,
      maskBottomHeight,
      maskLeft,
      maskRight
    });

    // Check and download file if it's a cloud storage URL
    if (rawSrc.startsWith('cloud://')) {
      wx.showLoading({ title: '加载图片中...', mask: true });
      wx.cloud.downloadFile({
        fileID: rawSrc,
        success: res => {
          wx.hideLoading();
          this.setData({ src: res.tempFilePath });
        },
        fail: err => {
          wx.hideLoading();
          console.error('下载云端图片失败', err);
          wx.showToast({ title: '加载图片失败', icon: 'none' });
          setTimeout(() => wx.navigateBack(), 1500);
        }
      });
    } else {
      this.setData({ src: rawSrc });
    }
  },

  onImageLoad(e) {
    const { width, height } = e.detail;
    const { cropW, cropH } = this.data;
    const sysInfo = wx.getSystemInfoSync();
    const W_s = sysInfo.windowWidth;
    const H_s = sysInfo.windowHeight;

    this.origW = width;
    this.origH = height;

    let imgWidth = cropW;
    let imgHeight = cropH;

    const imgAspect = width / height;
    const cropAspect = cropW / cropH;

    // Scale image to fill crop box entirely
    if (imgAspect > cropAspect) {
      imgHeight = cropH;
      imgWidth = Math.round(cropH * imgAspect);
    } else {
      imgWidth = cropW;
      imgHeight = Math.round(cropW / imgAspect);
    }

    // Centered coordinates initially
    const x = Math.round((W_s - imgWidth) / 2);
    const y = Math.round((H_s - imgHeight) / 2 - 60);

    this.setData({
      imgWidth,
      imgHeight,
      x,
      y
    });

    // Initialize position and scale
    this.currentX = x;
    this.currentY = y;
    this.currentScale = 1.0;
  },

  onChange(e) {
    this.currentX = e.detail.x;
    this.currentY = e.detail.y;
  },

  onScale(e) {
    this.currentX = e.detail.x;
    this.currentY = e.detail.y;
    this.currentScale = e.detail.scale;
  },

  onCancel() {
    wx.navigateBack();
  },

  onConfirm() {
    wx.showLoading({ title: '正在裁剪...', mask: true });

    const { cropW, cropH, maskLeft, maskTop, imgWidth } = this.data;

    // Calculate total scale relative to original image size
    const totalScale = (imgWidth * this.currentScale) / this.origW;

    // Relative displacement dx, dy from image top-left to crop box top-left
    const dx = this.currentX - maskLeft;
    const dy = this.currentY - maskTop;

    // Map screen displacement to original coordinates
    const sx = -dx / totalScale;
    const sy = -dy / totalScale;
    const sw = cropW / totalScale;
    const sh = cropH / totalScale;

    this.drawAndExport(sx, sy, sw, sh);
  },

  drawAndExport(sx, sy, sw, sh) {
    const self = this;
    const { src } = this.data;

    const query = wx.createSelectorQuery();
    query.select('#cropCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0] || !res[0].node) {
          wx.hideLoading();
          wx.showToast({ title: '画布加载失败', icon: 'none' });
          return;
        }

        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');

        // Set dimensions (750x520) matching the detail page banner
        const exportW = 750;
        const exportH = 520;
        canvas.width = exportW;
        canvas.height = exportH;

        const img = canvas.createImage();
        img.src = src;
        img.onload = () => {
          // Clear canvas
          ctx.clearRect(0, 0, exportW, exportH);
          
          // Clamp source dimensions to protect bounds
          let sourceX = Math.max(0, sx);
          let sourceY = Math.max(0, sy);
          let sourceW = Math.min(self.origW - sourceX, sw);
          let sourceH = Math.min(self.origH - sourceY, sh);

          // Draw cropped portion from original image onto export canvas
          ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, exportW, exportH);

          // Export to temp file
          wx.canvasToTempFilePath({
            canvas: canvas,
            destWidth: exportW,
            destHeight: exportH,
            fileType: 'jpg',
            quality: 0.95,
            success: (exportRes) => {
              wx.hideLoading();
              const eventChannel = self.getOpenerEventChannel();
              eventChannel.emit('cropSuccess', { tempFilePath: exportRes.tempFilePath });
              wx.navigateBack();
            },
            fail: (err) => {
              wx.hideLoading();
              console.error('Export failed', err);
              wx.showToast({ title: '导出失败', icon: 'none' });
            }
          });
        };
        img.onerror = (err) => {
          wx.hideLoading();
          console.error('Canvas image load failed', err);
          wx.showToast({ title: '图片加载失败', icon: 'none' });
        };
      });
  }
});
