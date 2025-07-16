class CharacterDisplay {
    constructor(imageElement, emojiElement) {
        this.imageElement = imageElement;
        this.emojiElement = emojiElement;
        this.supportedFormats = ['png', 'jpg', 'jpeg'];
        this.currentExpression = 'normal';
        
        // 初期状態でnormal表情を表示
        this.initializeDisplay();
    }
    
    initializeDisplay() {
        // 最初は絵文字を表示
        this.emojiElement.style.display = 'block';
        this.imageElement.style.display = 'none';
        
        // normal表情の画像を試行
        this.updateExpression('normal');
    }

    updateExpression(expression) {
        console.log('Updating expression to:', expression);
        this.currentExpression = expression;
        const basePath = `images/${expression}/${expression}`;
        this.tryLoadImage(basePath, this.supportedFormats, 0);
    }

    tryLoadImage(basePath, formats, index) {
        if (index >= formats.length) {
            console.log('All formats failed for', basePath, 'showing fallback');
            this.showFallback();
            return;
        }

        const testImage = new Image();
        const currentFormat = formats[index];
        const imagePath = `${basePath}.${currentFormat}`;
        
        console.log('Trying to load image:', imagePath);
        
        testImage.onload = () => {
            console.log('Image loaded successfully:', imagePath);
            this.showImage(imagePath);
        };
        
        testImage.onerror = (error) => {
            console.log('Failed to load image:', imagePath, 'Error:', error);
            this.tryLoadImage(basePath, formats, index + 1);
        };
        
        // 絶対パスで設定してみる
        testImage.src = `/${imagePath}`;
    }

    showImage(imagePath) {
        console.log('Showing image:', imagePath);
        this.imageElement.src = imagePath;
        this.imageElement.style.display = 'block';
        this.emojiElement.style.display = 'none';
        
        // 切り替えエフェクト
        this.imageElement.style.opacity = '0.5';
        setTimeout(() => {
            this.imageElement.style.opacity = '1';
        }, 200);
    }

    showFallback() {
        console.log('Showing fallback emoji');
        this.imageElement.style.display = 'none';
        this.emojiElement.style.display = 'block';
    }
}