(() => {
    document.addEventListener('DOMContentLoaded', () => {
        const SnowflakePatternMap = {
            Dot: 0,
            Branches: 1,
            Spearheads: 2,
            Asterisk: 3
        };

        class Utils {
            static random(min = 0, max = 1) {
                const value = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
                return min + (value * (max - min));
            }
        }

        class SnowflakeSprite {
            constructor(patternIndex) {
                this.canvas = document.createElement("canvas");
                this.ctx = this.canvas.getContext("2d");
                this.patternType = patternIndex;
                this.lineWidth = 1;
                this.radius = 10;

                const { devicePixelRatio } = window;
                const size = this.radius * 2 * devicePixelRatio;

                this.canvas.width = size;
                this.canvas.height = size;

                if (this.ctx) {
                    const color = "hsl(0, 0%, 100%)";
                    this.ctx.fillStyle = color;
                    this.ctx.strokeStyle = color;
                    this.ctx.lineCap = "round";
                    this.ctx.lineJoin = "round";
                    this.ctx.lineWidth = this.lineWidth;
                    this.ctx.scale(devicePixelRatio, devicePixelRatio);
                    this.drawPattern();
                }
            }

            drawPattern() {
                this.ctx?.save();
                this.ctx?.translate(this.radius, this.radius);

                if (this.patternType === SnowflakePatternMap.Dot) {
                    this.drawDot();
                    this.ctx?.restore();
                    return;
                }
                const sectors = 6;
                for (let i = 0; i < sectors; i++) {
                    this.ctx?.rotate(Math.PI / (sectors / 2));
                    switch (this.patternType) {
                        case SnowflakePatternMap.Branches:
                            this.drawBranch();
                            break;
                        case SnowflakePatternMap.Spearheads:
                            this.drawSpearhead();
                            break;
                        default:
                            this.drawAsteriskStroke();
                    }
                }
                this.ctx?.restore();
            }

            drawAsteriskStroke() {
                const adjustedRadius = this.radius - 1;
                this.ctx?.beginPath();
                this.ctx?.moveTo(0, 0);
                this.ctx?.lineTo(0, adjustedRadius);
                this.ctx?.closePath();
                this.ctx?.stroke();
            }

            drawBranch() {
                const adjustedRadius = this.radius - 0.5;
                const spurPos = -adjustedRadius * 0.5;
                const spurLength = adjustedRadius * 0.35;
                this.ctx?.beginPath();
                this.ctx?.moveTo(0, 0);
                this.ctx?.lineTo(0, -adjustedRadius);
                this.ctx?.moveTo(0, spurPos);
                this.ctx?.lineTo(-spurLength, spurPos - spurLength);
                this.ctx?.moveTo(0, spurPos);
                this.ctx?.lineTo(spurLength, spurPos - spurLength);
                this.ctx?.closePath();
                this.ctx?.stroke();
            }

            drawDot() {
                this.ctx?.beginPath();
                this.ctx?.arc(0, 0, this.radius / 2, 0, Math.PI * 2);
                this.ctx?.closePath();
                this.ctx?.fill();
            }

            drawSpearhead() {
                const adjustedRadius = this.radius - 0.5;
                const headStart = -adjustedRadius * 0.6;
                const headEnd = -adjustedRadius;
                const headWidth = adjustedRadius * 0.2;
                this.ctx?.beginPath();
                this.ctx?.moveTo(0, 0);
                this.ctx?.lineTo(0, -adjustedRadius * 0.5);
                this.ctx?.moveTo(0, headEnd);
                this.ctx?.lineTo(-headWidth, headStart);
                this.ctx?.lineTo(0, headStart + (adjustedRadius * 0.1));
                this.ctx?.lineTo(headWidth, headStart);
                this.ctx?.closePath();
                this.ctx?.stroke();
                this.ctx?.fill();
            }
        }

        class Snowflake {
            constructor(width, height, radius, pattern) {
                this.x = Utils.random(0, width);
                this.y = Utils.random(0, height);
                this.rotation = Utils.random(0, Math.PI);
                this.density = 50;
                this.pattern = pattern;
                this.radius = radius;
                this.rotationSpeed = Utils.random(-0.005, 0.005);
                this.speedX = Utils.random(-0.1, 0.1);
                this.speedY = Utils.random(0.2, 1);
            }

            draw(ctx) {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.rotation);
                ctx.drawImage(this.pattern, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
                ctx.restore();
            }

            update(cursor, width, height) {
                this.x += this.speedX;
                this.y += this.speedY;
                this.rotation += this.rotationSpeed;
                this.rotation %= 2 * Math.PI;

                const dx = (cursor.x ?? -cursor.radius) - this.x;
                const dy = (cursor.y ?? -cursor.radius) - this.y;
                const distance = Math.hypot(dx, dy);

                if (distance < cursor.radius) {
                    const forceDirectionX = dx / distance;
                    const forceDirectionY = dy / distance;
                    const force = (cursor.radius - distance) / cursor.radius;
                    const directionX = forceDirectionX * force * this.density;
                    const directionY = forceDirectionY * force * this.density;
                    this.x -= directionX;
                    this.y -= directionY;
                }

                const outsideLeft = this.x < -cursor.radius;
                const outsideRight = this.x > width + cursor.radius;
                const outsideBottom = this.y > height + cursor.radius;

                if (outsideLeft || outsideRight || outsideBottom) {
                    this.x = Utils.random(0, width);
                    this.y = -this.radius;
                }
            }
        }

        function initSnowfall() {
            const canvas = document.getElementById('snowfall-canvas');
            if (!canvas) return;
            
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            let frameId = 0;
            const snowflakes = [];
            const cursor = { radius: 60, x: 0, y: 0 };

            const sprites = [];
            for (let s = 0; s <= 3; ++s) {
                sprites.push(new SnowflakeSprite(s));
            }

            const getCanvas = () => {
                const { devicePixelRatio } = window;
                const width = canvas.width / devicePixelRatio;
                const height = canvas.height / devicePixelRatio;
                return { width, height };
            };

            const createSnowflakes = () => {
                const { width, height } = getCanvas();
                const snowflakesMin = Math.round(width * height / 800);
                const snowflakesMax = 1000;
                const snowflakeCount = Math.min(snowflakesMin, snowflakesMax);
                const radiusMin = 4;
                const radiusMax = 10;
                
                snowflakes.length = 0;

                for (let i = 0; i < snowflakeCount; i++) {
                    const radius = Utils.random(radiusMin, radiusMax);
                    const pattern = Math.round(Utils.random(0, 3));
                    snowflakes.push(new Snowflake(width, height, radius, sprites[pattern].canvas));
                }
            };

            const animate = () => {
                const { width, height } = getCanvas();
                ctx.clearRect(0, 0, width, height);
                ctx.globalAlpha = 0.8;
                snowflakes.forEach((flake) => {
                    flake.update(cursor, width, height);
                    flake.draw(ctx);
                });
                frameId = requestAnimationFrame(animate);
            };

            const handleDown = (e) => {
                cursor.x = e.clientX;
                cursor.y = e.clientY;
            };

            const handleUp = () => {
                cursor.x = -cursor.radius;
                cursor.y = -cursor.radius;
            };
            
            const resize = () => {
                const { devicePixelRatio, innerWidth, innerHeight } = window;
                canvas.width = innerWidth * devicePixelRatio;
                canvas.height = innerHeight * devicePixelRatio;
                canvas.style.width = innerWidth + "px";
                canvas.style.height = innerHeight + "px";
                ctx.scale(devicePixelRatio, devicePixelRatio);
                createSnowflakes();
            };

            resize();
            animate();

            window.addEventListener("resize", resize);
            canvas.addEventListener("pointerdown", handleDown);
            canvas.addEventListener("pointermove", handleDown);
            canvas.addEventListener("pointerout", handleUp);
            canvas.addEventListener("pointerup", handleUp);
        }

        initSnowfall();
    });
})();
