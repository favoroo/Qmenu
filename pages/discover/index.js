Page({
  data: {
    banners: [
      {
        id: 'b1',
        title: '夏日消暑，私房清凉菜谱限时上线！',
        image: '/assets/images/default_food.jpg'
      },
      {
        id: 'b2',
        title: '金牌大厨手把手教你复刻「椒麻鸡」',
        image: '/assets/images/default_food.jpg'
      }
    ],
    articles: [
      {
        id: 'a1',
        title: '椒麻鸡怎么做才够麻够爽口？这三个细节是关键！',
        summary: '很多人做椒麻鸡觉得不入味或者肉质柴，今天主厨给大家分享三个小技巧，保证你在家也能做出肉质Q弹、麻辣爽口的椒麻鸡！',
        author: '老饕主厨',
        avatar: '/assets/images/default_avatar.png',
        image: '/assets/images/default_food.jpg',
        views: 1845,
        likes: 126,
        isLiked: false
      },
      {
        id: 'a2',
        title: '红烧肉肥而不腻的秘诀：关键在“焯水”还是“煸油”？',
        summary: '红烧肉要做到入口即化、香甜软糯，煸油的火候至关重要。本文详细拆解红烧肉的制作步骤，新手也能零失败。',
        author: '美食研究所',
        avatar: '/assets/images/default_avatar.png',
        image: '/assets/images/hongshaorou_v2.jpg',
        views: 934,
        likes: 54,
        isLiked: false
      }
    ]
  },

  onLoad() {
    // Optional initialization
  },

  // Toggle Like on an article
  toggleLike(e) {
    const id = e.currentTarget.dataset.id;
    const articles = this.data.articles.map(article => {
      if (article.id === id) {
        const isLiked = !article.isLiked;
        return {
          ...article,
          isLiked: isLiked,
          likes: isLiked ? article.likes + 1 : article.likes - 1
        };
      }
      return article;
    });

    this.setData({ articles });
    wx.vibrateShort({ type: 'light' });
  },

  preventBubble() {
    // Helper to stop event bubbling
  },

  previewImage(e) {
    const src = e.currentTarget.dataset.src;
    wx.previewImage({
      urls: [src],
      current: src
    });
  },

  // Click on article detail (show a mock detail toast)
  viewArticle(e) {
    const title = e.currentTarget.dataset.title;
    wx.showModal({
      title: '主厨食记',
      content: `您已成功订阅文章《${title}》，食谱详情与详细步骤已发送至您的消息助手！`,
      showCancel: false,
      confirmText: '我知道了',
      confirmColor: '#005BCB'
    });
  }
});
