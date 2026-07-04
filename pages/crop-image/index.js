Page({
  data: {
    src: '',
    cropSize: 300,
    maskTop: 0,
    maskBottom: 0,
    maskLeft: 0,
    maskRight: 0,
    imgWidth: 300,
    imgHeight: 300,
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
    const cropSize = Math.round(W_s * 0.8);
    const maskLeft = Math.round((W_s - cropSize) / 2);
    const maskRight = maskLeft + cropSize;
    const maskTop = Math.round((H_s - cropSize) / 2 - 60);
    const maskBottom = maskTop + cropSize;

    this.setData({
      cropSize,
      maskTop,
      maskBottom,
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
    const { cropSize } = this.data;
    const sysInfo = wx.getSystemInfoSync();
    const W_s = sysInfo.windowWidth;
    const H_s = sysInfo.windowHeight;

    this.origW = width;
    this.origH = height;

    let imgWidth = cropSize;
    let imgHeight = cropSize;

    // Scale image to fill crop box entirely
    if (width > height) {
      imgWidth = Math.round((width / height) * cropSize);
    } else {
      imgHeight = Math.round((height / width) * cropSize);
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

    const { cropSize, maskLeft, maskTop, imgWidth } = this.data;

    // Calculate total scale relative to original image size
    const totalScale = (imgWidth * this.currentScale) / this.origW;

    // Relative displacement dx, dy from image top-left to crop box top-left
    const dx = this.currentX - maskLeft;
    const dy = this.currentY - maskTop;

    // Map screen displacement to original coordinates
    const sx = -dx / totalScale;
    const sy = -dy / totalScale;
    const sw = cropSize / totalScale;
    const sh = cropSize / totalScale;

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

        const exportSize = 600;
        canvas.width = exportSize;
        canvas.height = exportSize;

        const img = canvas.createImage();
        img.src = src;
        img.onload = () => {
          // Clear canvas
          ctx.clearRect(0, 0, exportSize, exportSize);
          
          // Clamp source dimensions to protect bounds
          let sourceX = Math.max(0, sx);
          let sourceY = Math.max(0, sy);
          let sourceW = Math.min(self.origW - sourceX, sw);
          let sourceH = Math.min(self.origH - sourceY, sh);

          // Draw cropped portion from original image onto export canvas
          ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, exportSize, exportSize);

          // Export to temp file
          wx.canvasToTempFilePath({
            canvas: canvas,
            destWidth: exportSize,
            destHeight: exportSize,
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
