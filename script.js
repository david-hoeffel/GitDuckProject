document.addEventListener('DOMContentLoaded', function() {
    // Split title into animated letters
    const titleText = "This Precious Town";
    const titleElement = document.getElementById('gameTitle');
    
    titleElement.innerHTML = titleText.split('').map((char, i) => 
        char === ' ' 
            ? '<span class="space" style="--char-index:'+i+'">&nbsp;</span>'
            : '<span style="--char-index:'+i+'">'+char+'</span>'
    ).join('');
    
    // Add extra space between words
    const spaces = titleElement.querySelectorAll('.space');
    spaces.forEach(space => {
        space.style.padding = '0 8px';
    });

    // Create starry background
    const starsContainer = document.getElementById('stars');
    for (let i = 0; i < 200; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        star.style.width = `${1 + Math.random() * 2}px`;
        star.style.height = star.style.width;
        star.style.animationDelay = `${Math.random() * 5}s`;
        starsContainer.appendChild(star);
    }

    // Game elements
    const grid3d = document.getElementById('grid3d');
    const sceneContainer = document.getElementById('sceneContainer');
    const energyContainer = document.getElementById('energyContainer');
    const toolSelection = document.querySelector('.tool-selection');
    const dirtTool = document.getElementById('dirt-tool');
    const mountainTool = document.getElementById('mountain-tool');
    const riverHouseTool = document.getElementById('river-house-tool');
    const farmerHouseTool = document.getElementById('farmer-house-tool');
    const blacksmithHouseTool = document.getElementById('blacksmith-house-tool');
    
    // Game settings
    let size = 5;
    const spacing = 110;
    let cells = [];
    let lastClickedIndex = null;
    let currentTool = 'dirt';
    let energy = 5;
    
    const maxVillagersPerHouse = {
        farmer: 34,
        river: 33,
        blacksmith: 33
    };
    let spawnedVillagers = {
        farmer: 0,
        river: 0,
        blacksmith: 0
    };
    
    let boarMovementCount = 0;
    const ambientSound = document.getElementById('ambientSound');
    ambientSound.volume = 0.5;
    ambientSound.play().catch(e => console.log("Audio play failed:", e));
    
    // Camera controls
    let isRotating = false;
    let startX, startY;
    let rotationX = 60;
    let rotationZ = 45;
    let zoomLevel = 2.2;
    let translateY = -30;
    const minZoom = 2.0;
    const maxZoom = 2.8;
    const minRotationZ = 0;
    const maxRotationZ = 90;
    
    // Game state variables
    let villagersReached = {
        farmer: 0,
        river: 0,
        blacksmith: 0
    };
    const maxBoars = 2;
    let currentBoars = 0;
    let boarInterval;
    let villagersRemaining = 100;
    let lastMilestone = 100;
    let boarSpawnForestIndex = null;
    const boarSpawnInterval = 60000;
    let lastBoarForestIndex = null;
    let isBoarSpawning = false;
    
    // Audio
    let currentSound = null;
	
	// ========== GAME STATE & CONFIG ==========
	const gameConfig = {
		initialVillagers: 100,
		maxBoars: 2,
		boarSpawnInterval: 60000,
		difficultyScaling: {
			interval: 120000, // 2 minutes
			boarIncrease: 1,
			speedIncrease: 0.1
		},
		villagerTypes: {
			normal: { speed: 1, resilience: 1 },
			fast: { speed: 1.5, resilience: 0.7 },
			strong: { speed: 0.8, resilience: 2 },
			wise: { speed: 1, resilience: 1, avoidsBoars: true }
		},
		events: {
			interval: 90000, // 1.5 minutes
			possibleEvents: ['rain', 'festival', 'plague', 'earthquake']
		}
	};

	let gameState = {
		difficulty: 1,
		villagersRemaining: gameConfig.initialVillagers,
		spawnedVillagers: { farmer: 0, river: 0, blacksmith: 0 },
		villagersReached: { farmer: 0, river: 0, blacksmith: 0 },
		currentBoars: 0,
		activeEvents: [],
		lastMilestone: gameConfig.initialVillagers,
		gameTime: 0,
		resources: {
			food: 100,
			materials: 50,
			energy: 5
		},
		upgrades: {
			houses: { level: 1, cost: 30 },
			paths: { level: 1, cost: 20 }
		}
	};
    
    // Villager management system
    const villagers = new Map();
    let movementCheckInterval;
    updateVillagerCounter();
    
    document.addEventListener('DOMContentLoaded', function() {
		// Initialize UI
		createResourceDisplay();
		createUpgradeButtons();
		
		// Start game systems
		const cleanupGameLoop = startGameLoop();
		startMovementChecker();
		startBoarSpawning();
		
		// Victory condition check
		const victoryCheck = setInterval(() => {
			if (gameState.villagersRemaining <= 0) {
				checkVictory();
				clearInterval(victoryCheck);
			}
		}, 1000);
        document.querySelectorAll('.house-tool').forEach(tool => {
            tool.style.opacity = '0';
            tool.style.transform = 'translateY(20px)';
            tool.style.visibility = 'hidden';
        });
    });

    function positionVillagerOnHouse(villager, cell) {
        const cellRect = cell.getBoundingClientRect();
        const sceneRect = sceneContainer.getBoundingClientRect();
        
        const x = cellRect.left - sceneRect.left + cellRect.width/2 - 15;
        const y = cellRect.top - sceneRect.top + cellRect.height/2 - 30;
        
        villager.style.left = `${x}px`;
        villager.style.top = `${y}px`;
        villager.style.transform = 'none';
        
        if (!villager.parentNode || villager.parentNode !== sceneContainer) {
            sceneContainer.appendChild(villager);
        }
    }

    function updateVillagerCounter() {
        villagersRemaining = Math.max(0, villagersRemaining);
        document.getElementById('villagerCount').textContent = villagersRemaining;
        
        if (villagersRemaining <= lastMilestone - 10 || villagersRemaining === 10) {
            playMilestoneSound(villagersRemaining);
            lastMilestone = villagersRemaining;
        }
        
        if (villagersRemaining <= 0) {
            checkVictory();
        }
    }

    function playMilestoneSound(currentCount) {
        if (currentCount % 10 === 0) {
            const villagerSound = document.getElementById('villagerSound');
            villagerSound.currentTime = 0;
            villagerSound.play();
            
            const counter = document.querySelector('.villager-counter');
            counter.style.transform = 'scale(1.1)';
            counter.style.color = '#ffeb3b';
            
            createCounterSparkles();
            
            setTimeout(() => {
                counter.style.transform = 'scale(1)';
                counter.style.color = 'white';
            }, 300);
        }
    }

    function createCounterSparkles() {
        const counter = document.querySelector('.villager-counter');
        const sparkleContainer = document.createElement('div');
        sparkleContainer.className = 'sparkle-container';
        sparkleContainer.style.position = 'absolute';
        sparkleContainer.style.width = '100%';
        sparkleContainer.style.height = '100%';
        sparkleContainer.style.pointerEvents = 'none';
        
        for (let i = 0; i < 15; i++) {
            const sparkle = document.createElement('div');
            sparkle.className = 'sparkle';
            sparkle.style.position = 'absolute';
            sparkle.style.width = '6px';
            sparkle.style.height = '6px';
            sparkle.style.backgroundColor = '#ffeb3b';
            sparkle.style.borderRadius = '50%';
            sparkle.style.boxShadow = '0 0 8px 1px #ffeb3b';
            sparkle.style.left = `${Math.random() * 100}%`;
            sparkle.style.top = `${Math.random() * 100}%`;
            
            const angle = Math.random() * Math.PI * 2;
            const distance = 20 + Math.random() * 30;
            sparkle.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
            sparkle.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
            sparkle.style.animation = `sparkle-fade 1s ease-out forwards`;
            sparkle.style.animationDelay = `${Math.random() * 0.5}s`;
            
            sparkleContainer.appendChild(sparkle);
        }
        
        counter.appendChild(sparkleContainer);
        setTimeout(() => sparkleContainer.remove(), 1000);
    }

    function startAmbientSound() {
        const playPromise = ambientSound.play();
        
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                document.body.addEventListener('click', function enableSound() {
                    ambientSound.play();
                    document.body.removeEventListener('click', enableSound);
                }, { once: true });
            });
        }
    }

    startAmbientSound();

    function createVillagerForHouse(houseIndex) {
        const cell = cells[houseIndex];
        if (!cell) return null;
        
        const villager = document.createElement('div');
        villager.className = 'villager';
        positionEntityOnCell(villager, cell);
        
        const sound = document.getElementById('villagerSound').cloneNode();
        sound.play();
        
        return villager;
    }
    
    function updateToolCostIndicators() {
        document.querySelectorAll('.tool-btn').forEach(tool => {
            const costIndicator = tool.querySelector('.tool-cost');
            if (!costIndicator) return;
            
            const energyCosts = costIndicator.querySelectorAll('.energy-cost');
            energyCosts.forEach((costDot, index) => {
                if (index < energy) {
                    costDot.style.animation = 'pulse-energy 2s infinite ease-in-out';
                    costDot.style.opacity = '0.9';
                } else {
                    costDot.style.animation = 'none';
                    costDot.style.opacity = '0.3';
                }
            });
        });
    }

    function findPathToCastle(startIndex) {
        const castleIndex = cells.findIndex(cell => cell && cell.dataset.state === 'castle');
        if (castleIndex === -1) return null;
        
        const startCell = cells[startIndex];
        const startRow = parseInt(startCell.dataset.row);
        const startCol = parseInt(startCell.dataset.col);
        const houseType = startCell.dataset.state.split('_')[0];
        
        const castleRow = parseInt(cells[castleIndex].dataset.row);
        const castleCol = parseInt(cells[castleIndex].dataset.col);
        
        const queue = [[startRow, startCol, []]];
        const visited = new Set();
        visited.add(`${startRow},${startCol}`);
        
        const directions = [
            {row: -1, col: 0},
            {row: 1, col: 0},
            {row: 0, col: -1},
            {row: 0, col: 1}
        ];
        
        while (queue.length > 0) {
            const [currentRow, currentCol, path] = queue.shift();
            const currentIndex = currentRow * size + currentCol;
            
            if (currentRow === castleRow && currentCol === castleCol) {
                return path.concat([currentIndex]);
            }
            
            for (const dir of directions) {
                const newRow = currentRow + dir.row;
                const newCol = currentCol + dir.col;
                const newIndex = newRow * size + newCol;
                
                if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size) {
                    const cell = cells[newIndex];
                    
                    if (!cell || 
                        cell.dataset.state === 'empty' || 
                        cell.dataset.state === 'forest' ||
                        cell.dataset.state.endsWith('_house')) {
                        continue;
                    }
                    
                    if (path.length === 0) {
                        let isValidFirstStep = false;
                        switch(houseType) {
                            case 'farmer':
                                isValidFirstStep = (cell.dataset.state === 'grass');
                                break;
                            case 'river':
                                isValidFirstStep = (cell.dataset.state === 'puddle');
                                break;
                            case 'blacksmith':
                                isValidFirstStep = (cell.dataset.state === 'mountain');
                                break;
                        }
                        if (!isValidFirstStep) continue;
                    }
                    
                    if (!visited.has(`${newRow},${newCol}`)) {
                        visited.add(`${newRow},${newCol}`);
                        queue.push([newRow, newCol, path.concat([currentIndex])]);
                    }
                }
            }
        }
        return null;
    }
    
    function updateHouseVisuals() {
        cells.forEach(cell => {
            if (cell && ['river_house', 'farmer_house', 'blacksmith_house'].includes(cell.dataset.state)) {
                const houseType = cell.dataset.state.split('_')[0];
                if (spawnedVillagers[houseType] >= maxVillagersPerHouse[houseType]) {
                    cell.style.filter = 'grayscale(80%) brightness(0.7)';
                    cell.style.pointerEvents = 'none';
                } else {
                    cell.style.filter = '';
                    cell.style.pointerEvents = '';
                }
            }
        });
    }
    
    function checkVictory() {
        if (villagersRemaining <= 0 && 
            spawnedVillagers.farmer >= maxVillagersPerHouse.farmer && 
            spawnedVillagers.river >= maxVillagersPerHouse.river && 
            spawnedVillagers.blacksmith >= maxVillagersPerHouse.blacksmith) {
            
            clearInterval(movementCheckInterval);
            clearInterval(boarInterval);
            
            document.querySelectorAll('.villager').forEach(villager => {
                villager.style.animation = 'none';
                villager.style.transition = 'none';
            });
            
            document.querySelectorAll('.boar').forEach(boar => {
                boar.style.animation = 'none';
                boar.style.transition = 'none';
            });
            
            if (!document.querySelector('.victory-overlay')) {
                const victoryOverlay = document.createElement('div');
                victoryOverlay.className = 'victory-overlay';
                
                const victoryPopup = document.createElement('div');
                victoryPopup.className = 'victory-popup';
                
                const victoryTitle = document.createElement('h1');
                victoryTitle.className = 'victory-title';
                victoryTitle.textContent = 'Victory!';
                
                const victoryMessage = document.createElement('div');
                victoryMessage.className = 'victory-message';
                victoryMessage.textContent = 'Your town has flourished! All villagers have reached the castle.';
                
                victoryPopup.appendChild(victoryTitle);
                victoryPopup.appendChild(victoryMessage);
                victoryOverlay.appendChild(victoryPopup);
                
                document.body.appendChild(victoryOverlay);
                
                const fireworksSound = new Audio('fireworks.mp3');
                fireworksSound.loop = true;
                fireworksSound.play();
                
                createConfetti();
                
                const confettiInterval = setInterval(createConfetti, 3000);
                victoryOverlay.dataset.confettiInterval = confettiInterval;
            }
        }
    }

    function createConfetti() {
        const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', 
                       '#03a9f4', '#00bcd4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', 
                       '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'];
        
        for (let i = 0; i < 150; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.position = 'fixed';
            confetti.style.left = `${Math.random() * 100}vw`;
            confetti.style.top = `-20px`;
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            
            const tx = (Math.random() - 0.5) * 200;
            const ty = window.innerHeight + 100;
            const rotation = Math.random() * 360;
            const duration = 2 + Math.random() * 3;
            const size = 8 + Math.random() * 8;
            
            confetti.style.width = `${size}px`;
            confetti.style.height = `${size}px`;
            confetti.style.setProperty('--tx', `${tx}px`);
            confetti.style.setProperty('--ty', `${ty}px`);
            confetti.style.animationDuration = `${duration}s`;
            confetti.style.animationDelay = `${Math.random()}s`;
            
            document.body.appendChild(confetti);
            
            setTimeout(() => {
                if (confetti.parentNode) {
                    confetti.parentNode.removeChild(confetti);
                }
            }, duration * 1000);
        }
    }

    function moveVillager(villager, path) {  
        if (!path || path.length === 0) return;  

        const startCell = cells[path[0]];  
        const sceneRect = sceneContainer.getBoundingClientRect();  
        const startCellRect = startCell.getBoundingClientRect();  
        const startX = startCellRect.left - sceneRect.left + startCellRect.width/2 - 15;
        const startY = startCellRect.top - sceneRect.top + startCellRect.height/2 - 15;
        villager.style.left = `${startX}px`;  
        villager.style.top = `${startY}px`;  

        villager.classList.remove('moving-villager');  
        void villager.offsetWidth;
        villager.classList.add('moving-villager');  

        const DURATION = 400;
        const STEPS = 60;
        const STEP_DURATION = DURATION / STEPS;  

        let currentStep = 0;  
        let currentCellIndex = 0;  
        let startXPos = startX;  
        let startYPos = startY;  
        let targetX, targetY;  

        const initializeTargetPosition = (cellIndex) => {  
            const nextCell = cells[path[cellIndex + 1]];  
            const sceneRect = sceneContainer.getBoundingClientRect();  
            const nextCellRect = nextCell.getBoundingClientRect();  
            targetX = nextCellRect.left - sceneRect.left + nextCellRect.width/2 - 15;  
            targetY = nextCellRect.top - sceneRect.top + nextCellRect.height/2 - 15;  
        };  

        initializeTargetPosition(currentCellIndex);  

        function animate() {  
            if (currentStep >= STEPS) {  
                currentCellIndex++;  
                currentStep = 0;  

                if (currentCellIndex >= path.length - 1) {  
                    villager.classList.remove('moving-villager');  
                    setTimeout(() => {  
                        if (villager.parentNode) {  
                            villager.parentNode.removeChild(villager);  
                        }  
                    }, 300);  
                    return;  
                }  

                startXPos = parseFloat(villager.style.left);  
                startYPos = parseFloat(villager.style.top);  
                initializeTargetPosition(currentCellIndex);  
            }  

            const progress = currentStep / STEPS;  
            const easedProgress = progress < 0.5   
                ? 2 * progress * progress   
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;  

            const currentX = startXPos + (targetX - startXPos) * easedProgress;  
            const currentY = startYPos + (targetY - startYPos) * easedProgress;  

            villager.style.left = `${currentX}px`;  
            villager.style.top = `${currentY}px`;  

            currentStep++;  
            requestAnimationFrame(animate);  
        }  

        requestAnimationFrame(animate);  
    }  

    function checkAndMoveVillagers() {
        if (villagersRemaining <= 0) return;

        const castleExists = cells.some(cell => cell && cell.dataset.state === 'castle');
        if (!castleExists) return;

        cells.forEach((cell, index) => {
            if (cell && ['river_house', 'farmer_house', 'blacksmith_house'].includes(cell.dataset.state)) {
                const houseType = cell.dataset.state.split('_')[0];
                
                if (spawnedVillagers[houseType] >= maxVillagersPerHouse[houseType]) {
                    return;
                }

                if (!villagers.has(index)) {
                    const villager = createVillagerForHouse(index);
                    if (villager) {
                        villagers.set(index, villager);
                        spawnedVillagers[houseType]++;
                    }
                }
                
                const villager = villagers.get(index);
                if (villager && !villager.isMoving) {
                    const path = findPathToCastle(index);
                    if (path && path.length > 0) {
                        villager.isMoving = true;
                        setTimeout(() => {
                            moveEntity(villager, path, 'villager');
                            villagers.delete(index);
                        }, 1000);
                    }
                }
            }
        });
        
        updateHouseVisuals();
    }

    function positionEntityOnCell(entity, cell) {
        const cellRect = cell.getBoundingClientRect();
        const sceneRect = sceneContainer.getBoundingClientRect();
        
        const x = cellRect.left - sceneRect.left + cellRect.width/2 - 30;
        const y = cellRect.top - sceneRect.top + cellRect.height/2 - 45;
        
        entity.style.left = `${x}px`;
        entity.style.top = `${y}px`;
        
        if (!entity.parentNode || entity.parentNode !== sceneContainer) {
            sceneContainer.appendChild(entity);
        }
    }

    function moveEntity(entity, path, type) {  
        if (!path || path.length === 0 || villagersRemaining <= 0) return;  

        const sceneRect = sceneContainer.getBoundingClientRect();  
        
        positionEntityOnCell(entity, cells[path[0]]);  
        
        const sceneLeft = sceneRect.left;  
        const sceneTop = sceneRect.top;  
        
        let startX = parseFloat(entity.style.left);  
        let startY = parseFloat(entity.style.top);  
        
        const firstCell = cells[path[0]];  
        const firstCellRect = firstCell.getBoundingClientRect();  
        const targetX = firstCellRect.left - sceneLeft + firstCellRect.width/2 - 30;  
        const targetY = firstCellRect.top - sceneTop + firstCellRect.height/2 - 45;  
        
        entity.style.transition = `transform ${800}ms cubic-bezier(0.4, 0, 0.2, 1)`;  
        
        entity.style.transform = `translate(${targetX - startX}px, ${targetY - startY}px)`;  
        
        let currentIndex = 0;  
        const moveSpeed = type === 'villager' ? 800 : 2000;  
        
        const moveNext = () => {  
            if (currentIndex >= path.length - 1 || villagersRemaining <= 0) {  
                if (type === 'villager' && villagersRemaining > 0) {  
                    const houseType = cells[path[0]].dataset.state.split('_')[0];  
                    villagersReached[houseType]++;  
                    villagersRemaining--;
                    updateVillagerCounter();
                    if (villagersRemaining <= 0) {
                        checkVictory();  
                    }
                }  
                
                entity.style.transition = 'none';  
                entity.addEventListener('transitionend', () => {  
                    if (entity.parentNode) entity.parentNode.removeChild(entity);  
                    if (type === 'boar') currentBoars--;  
                });  
                
                return;  
            }  
            
            currentIndex++;  
            const nextCell = cells[path[currentIndex]];  
            const nextCellRect = nextCell.getBoundingClientRect();  
            const nextTargetX = nextCellRect.left - sceneLeft + nextCellRect.width/2 - 40;  
            const nextTargetY = nextCellRect.top - sceneTop + nextCellRect.height/2 - 60;  
            
            entity.style.transform = `translate(${nextTargetX - startX}px, ${nextTargetY - startY}px)`;  
            
            setTimeout(moveNext, moveSpeed);  
        };  
        
        setTimeout(moveNext, 50);  
    }    

    function startBoarSpawning() {
        if (!boarInterval) {
            setTimeout(spawnBoar, 1000);
            boarInterval = setInterval(spawnBoar, boarSpawnInterval);
        }
    }

    function spawnBoar() {
        if (currentBoars >= maxBoars || isBoarSpawning) return;
        
        isBoarSpawning = true;
        
        const availableForests = cells.filter((cell, index) => 
            cell && 
            cell.dataset.state === 'forest' && 
            index !== lastBoarForestIndex
        );
        
        if (availableForests.length === 0) {
            isBoarSpawning = false;
            return;
        }
        
        const spawnCell = availableForests[Math.floor(Math.random() * availableForests.length)];
        const spawnIndex = parseInt(spawnCell.dataset.index);
        lastBoarForestIndex = spawnIndex;
        
        spawnCell.classList.add('boar-spawn-warning');
        
        setTimeout(() => {
            spawnCell.classList.remove('boar-spawn-warning');
            spawnCell.classList.add('boar-spawning');
            
            const boar = document.createElement('div');
            boar.className = 'boar';
            
            const cellRect = spawnCell.getBoundingClientRect();
            const sceneRect = sceneContainer.getBoundingClientRect();
            const x = cellRect.left - sceneRect.left + cellRect.width/2 - 30;
            const y = cellRect.top - sceneRect.top + cellRect.height/2 - 45;
            
            boar.style.left = `${x}px`;
            boar.style.top = `${y}px`;
            sceneContainer.appendChild(boar);
            
            currentBoars++;
            
            const warningSound = document.getElementById('bellSound1');
            warningSound.currentTime = 0;
            warningSound.play();
            
            setTimeout(() => {
                const boarSound = document.getElementById('boarSound');
                boarSound.currentTime = 0;
                boarSound.play();
            }, 300);
            
            setTimeout(() => {
                spawnCell.classList.remove('boar-spawning');
                wanderBoar(boar, spawnIndex);
                isBoarSpawning = false;
            }, 1000);
            
        }, 3000);
    }
    
    function moveBoar(boar, fromIndex, toIndex) {
        const fromCell = cells[fromIndex];
        const toCell = cells[toIndex];
        
        const fromRect = fromCell.getBoundingClientRect();
        const toRect = toCell.getBoundingClientRect();
        const sceneRect = sceneContainer.getBoundingClientRect();
        
        const startX = fromRect.left - sceneRect.left + fromRect.width/2 - 30;
        const startY = fromRect.top - sceneRect.top + fromRect.height/2 - 45;
        const endX = toRect.left - sceneRect.left + toRect.width/2 - 30;
        const endY = toRect.top - sceneRect.top + toRect.height/2 - 45;
        
        boar.style.left = `${startX}px`;
        boar.style.top = `${startY}px`;
        
        boar.classList.remove('moving-boar');
        void boar.offsetWidth;
        boar.classList.add('moving-boar');
        
        boar.style.transition = 'left 2s ease-out, top 2s ease-out';
        boar.style.left = `${endX}px`;
        boar.style.top = `${endY}px`;
        
        setTimeout(() => {
            boar.classList.remove('moving-boar');
            if (boar.parentNode) {
                const currentCell = cells[toIndex];
                if (currentCell.dataset.state === 'empty') {
                    currentCell.className = 'cell dirt';
                    currentCell.dataset.state = 'dirt';
                    const boarSound = document.getElementById('boarSound');
                    boarSound.currentTime = 0;
                    boarSound.play();
                }
                setTimeout(() => wanderBoar(boar, toIndex), 9000);
            }
        }, 2000);
    }

    function wanderBoar(boar, currentIndex) {
        if (villagersRemaining <= 0) {
            if (boar.parentNode) boar.parentNode.removeChild(boar);
            currentBoars--;
            return;
        }

        const directions = [
            {row: -1, col: 0}, {row: 1, col: 0},
            {row: 0, col: -1}, {row: 0, col: 1}
        ];
        
        const currentRow = parseInt(cells[currentIndex].dataset.row);
        const currentCol = parseInt(cells[currentIndex].dataset.col);
        const isEdgeBoar = (currentRow === 5 || currentCol === 5);
        
        const validMoves = [];
        for (const dir of directions) {
            const newRow = currentRow + dir.row;
            const newCol = currentCol + dir.col;
            
            if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size) {
                const newIndex = newRow * size + newCol;
                const cell = cells[newIndex];
                const state = cell.dataset.state;
                
                if (isEdgeBoar && state === 'forest') {
                    validMoves.push(newIndex);
                }
                else if (['empty', 'dirt', 'grass', 'puddle'].includes(state)) {
                    validMoves.push(newIndex);
                }
            }
        }
        
        if (validMoves.length === 0) {
            setTimeout(() => wanderBoar(boar, currentIndex), 9000);
            return;
        }
        
        const nextIndex = validMoves[Math.floor(Math.random() * validMoves.length)];
        const nextCell = cells[nextIndex];
        
        const originalState = nextCell.dataset.state;
        
        if (nextCell.dataset.state !== 'forest') {
            switch(nextCell.dataset.state) {
                case 'puddle':
                    nextCell.className = 'cell grass';
                    nextCell.dataset.state = 'grass';
                    break;
                case 'grass':
                    nextCell.className = 'cell dirt';
                    nextCell.dataset.state = 'dirt';
                    break;
                case 'empty':
                    nextCell.className = 'cell dirt';
                    nextCell.dataset.state = 'dirt';
                    const boarSound = document.getElementById('boarSound');
                    boarSound.currentTime = 0;
                    boarSound.play();
                    break;
            }
        }
        
        moveBoar(boar, currentIndex, nextIndex);
        
        setTimeout(() => {
            const currentCell = cells[currentIndex];
            if (currentCell.dataset.state === 'empty') {
                currentCell.className = 'cell dirt';
                currentCell.dataset.state = 'dirt';
            }
            
            const row = parseInt(currentCell.dataset.row);
            const col = parseInt(currentCell.dataset.col);
            
            const directions = [
                {row: 0, col: 1}, {row: 1, col: 0}, 
                {row: 0, col: -1}, {row: -1, col: 0}
            ];
            
            for (const dir of directions) {
                const adjRow = row + dir.row;
                const adjCol = col + dir.col;
                if (adjRow >= 0 && adjRow < size && adjCol >= 0 && adjCol < size) {
                    const adjIndex = adjRow * size + adjCol;
                    checkCellPair(currentIndex, adjIndex);
                }
            }
        }, 100);
        
        boarMovementCount++;
        if (boarMovementCount % 5 === 0) {
            const boarSound = document.getElementById('boarSound');
            boarSound.currentTime = 0;
            boarSound.play();
        }
    }

    function startMovementChecker() {
        if (movementCheckInterval) clearInterval(movementCheckInterval);
        movementCheckInterval = setInterval(() => {
            checkAndMoveVillagers();
        }, 1000);
    }

    function checkVillagerMovementConditions() {
        const castleExists = cells.some(cell => cell && cell.dataset.state === 'castle');
        if (castleExists) {
            startMovementChecker();
            startBoarSpawning();
        } else {
            if (movementCheckInterval) clearInterval(movementCheckInterval);
            if (boarInterval) {
                clearInterval(boarInterval);
                boarInterval = null;
            }
        }
    }

    function selectTool(tool) {
        if ((tool === 'mountain' && energy < 1) ||
            ((tool === 'river_house' || tool === 'farmer_house' || tool === 'blacksmith_house') && energy < 2)) {
            tool = 'dirt';
        }
        
        dirtTool.classList.remove('active');
        mountainTool.classList.remove('active');
        riverHouseTool.classList.remove('active');
        farmerHouseTool.classList.remove('active');
        blacksmithHouseTool.classList.remove('active');
        
        currentTool = tool;
        const toolElement = document.getElementById(`${tool.replace(/_/g,'-')}-tool`);
        if (toolElement) toolElement.classList.add('active');
    }
    
    dirtTool.addEventListener('click', () => selectTool('dirt'));
    mountainTool.addEventListener('click', () => selectTool('mountain'));
    riverHouseTool.addEventListener('click', () => selectTool('river_house'));
    farmerHouseTool.addEventListener('click', () => selectTool('farmer_house'));
    blacksmithHouseTool.addEventListener('click', () => selectTool('blacksmith_house'));
    
    function updateEnergyDisplay() {
        const energyDots = energyContainer.querySelectorAll('.energy');
        energyDots.forEach((dot, index) => {
            if (index < energy) {
                dot.style.opacity = '1';
                dot.style.animation = 'pulse-energy 8s infinite ease-in-out';
                dot.style.animationDelay = `${index * 0.8}s`;
            } else {
                dot.style.animation = 'none';
                dot.style.opacity = '0.3';
            }
        });
        
        mountainTool.disabled = energy < 1;
        riverHouseTool.disabled = energy < 2;
        farmerHouseTool.disabled = energy < 2;
        blacksmithHouseTool.disabled = energy < 2;
        
        if ((currentTool === 'mountain' && energy < 1) ||
            (currentTool === 'river_house' && energy < 2) ||
            (currentTool === 'farmer_house' && energy < 2) ||
            (currentTool === 'blacksmith_house' && energy < 2)) {
            selectTool('dirt');
        }
        updateToolCostIndicators();
    }
    
    function highlightAdjacentEmptyCells(index) {
        const cell = cells[index];
        if (!cell || !['blacksmith_house', 'river_house', 'farmer_house'].includes(cell.dataset.state)) {
            return;
        }

        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        
        let highlightClass, cancelTerrain;
        switch(cell.dataset.state) {
            case 'blacksmith_house':
                highlightClass = 'highlight-blacksmith';
                cancelTerrain = 'mountain';
                break;
            case 'river_house':
                highlightClass = 'highlight-river';
                cancelTerrain = 'puddle';
                break;
            case 'farmer_house':
                highlightClass = 'highlight-farmer';
                cancelTerrain = 'grass';
                break;
        }

        const directions = [
            {row: -1, col: 0}, {row: 1, col: 0},
            {row: 0, col: -1}, {row: 0, col: 1}
        ];

        for (const dir of directions) {
            const newRow = row + dir.row;
            const newCol = col + dir.col;
            if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size) {
                const adjacentIndex = newRow * size + newCol;
                const adjacentCell = cells[adjacentIndex];
                if (adjacentCell && adjacentCell.dataset.state === 'empty') {
                    adjacentCell.classList.remove(highlightClass);
                }
            }
        }

        let shouldHighlight = true;
        for (const dir of directions) {
            const newRow = row + dir.row;
            const newCol = col + dir.col;
            if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size) {
                const adjacentIndex = newRow * size + newCol;
                const adjacentCell = cells[adjacentIndex];
                if (adjacentCell && adjacentCell.dataset.state === cancelTerrain) {
                    shouldHighlight = false;
                    break;
                }
            }
        }

        if (shouldHighlight) {
            for (const dir of directions) {
                const newRow = row + dir.row;
                const newCol = col + dir.col;
                if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size) {
                    const adjacentIndex = newRow * size + newCol;
                    const adjacentCell = cells[adjacentIndex];
                    if (adjacentCell && adjacentCell.dataset.state === 'empty') {
                        adjacentCell.classList.add(highlightClass);
                    }
                }
            }
        }
    }

    function updateHighlightsForAllHouses() {
        document.querySelectorAll('.cell.empty').forEach(cell => {
            cell.classList.remove('highlight-blacksmith', 'highlight-river', 'highlight-farmer');
        });

        cells.forEach((cell, index) => {
            if (cell && ['blacksmith_house', 'river_house', 'farmer_house'].includes(cell.dataset.state)) {
                highlightAdjacentEmptyCells(index);
            }
        });
    }

    function createSparkles(element, level) {
        const rect = element.getBoundingClientRect();
        const container = document.createElement('div');
        container.className = 'sparkle-container';
        container.style.left = `${rect.left}px`;
        container.style.top = `${rect.top}px`;
        
        for (let i = 0; i < 15; i++) {
            const sparkle = document.createElement('div');
            sparkle.className = 'sparkle';
            const angle = Math.random() * Math.PI * 2;
            const distance = 20 + Math.random() * 30;
            sparkle.style.left = `${Math.random() * 100}px`;
            sparkle.style.top = `${Math.random() * 100}px`;
            sparkle.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
            sparkle.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
            container.appendChild(sparkle);
        }
        
        if (['puddle', 'river_house'].includes(level)) {
            for (let i = 0; i < 60; i++) {
                const sparkle = document.createElement('div');
                sparkle.className = 'blue-sparkle';
                const angle = Math.random() * Math.PI * 2;
                const distance = 30 + Math.random() * 40;
                sparkle.style.left = `${Math.random() * 100}px`;
                sparkle.style.top = `${Math.random() * 100}px`;
                sparkle.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
                sparkle.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
                container.appendChild(sparkle);
            }
        }
        
        if (['blacksmith_house', 'castle'].includes(level)) {
            for (let i = 0; i < 60; i++) {
                const sparkle = document.createElement('div');
                sparkle.className = 'red-sparkle';
                const angle = Math.random() * Math.PI * 2;
                const distance = 50 + Math.random() * 60;
                sparkle.style.left = `${Math.random() * 100}px`;
                sparkle.style.top = `${Math.random() * 100}px`;
                sparkle.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
                sparkle.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
                container.appendChild(sparkle);
            }
        }
        
        if (level === 'village' || level === 'castle') {
            if (level === 'castle') {
                for (let i = 0; i < 100; i++) {
                    const sparkle = document.createElement('div');
                    sparkle.className = 'sparkle';
                    sparkle.style.width = '6px';
                    sparkle.style.height = '6px';
                    const angle = Math.random() * Math.PI * 2;
                    const distance = 70 + Math.random() * 80;
                    sparkle.style.left = `${Math.random() * 100}px`;
                    sparkle.style.top = `${Math.random() * 100}px`;
                    sparkle.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
                    sparkle.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
                    container.appendChild(sparkle);
                }
            }
            
            if (level === 'village') {
                setTimeout(() => {
                    energyContainer.classList.add('show');
                    toolSelection.classList.add('show');
                    
                    const tools = document.querySelectorAll('.tool-btn:not(.house-tool)');
                    tools.forEach((tool, index) => {
                        setTimeout(() => {
                            tool.classList.add('show');
                        }, index * 100);
                    });
                }, 300);
                
                if (!document.querySelector('.cell[data-state="village"]')) {
                    energy = 5;
                    updateEnergyDisplay();
                }
                
                selectTool('dirt');
            }
        }
        
        document.body.appendChild(container);
        setTimeout(() => container.remove(), 2500);
    }
    
    function createCell(index, row, col) {
        const cell = document.createElement('div');
        cell.className = 'cell empty';
        cell.dataset.index = index;
        cell.dataset.state = 'empty';
        cell.dataset.row = row;
        cell.dataset.col = col;
        
        ['front', 'back', 'right', 'left', 'top', 'bottom'].forEach(face => {
            const faceElement = document.createElement('div');
            faceElement.className = `cell-face cell-${face}`;
            cell.appendChild(faceElement);
            
            if (face === 'front') {
                faceElement.addEventListener('click', handleCellClick);
                faceElement.dataset.index = index;
            }
        });
        
        const center = (size-1)/2;
        const x = (col - center) * spacing;
        const y = (row - center) * spacing;
        
        cell.style.opacity = '0';
        cell.style.transition = 'transform 0.5s ease-out';
        
        setTimeout(() => {
            cell.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            cell.style.opacity = '1';
        }, 1 * index);
        
        grid3d.appendChild(cell);
        cells[index] = cell;
        return cell;
    }
    
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const index = row * size + col;
            createCell(index, row, col);
        }
    }
    
    sceneContainer.addEventListener('mousedown', function(e) {
        if (e.button === 2) {
            isRotating = true;
            startX = e.clientX;
            startY = e.clientY;
            e.preventDefault();
        }
    });
    
    document.addEventListener('mousemove', function(e) {
        if (!isRotating) return;
        
        rotationZ = Math.max(minRotationZ, Math.min(maxRotationZ, rotationZ + (e.clientX - startX) * 0.2));
        rotationX = Math.max(45, Math.min(75, rotationX - (e.clientY - startY) * 0.1));
        startX = e.clientX;
        startY = e.clientY;
    });
    
    document.addEventListener('mouseup', function(e) {
        if (e.button === 2) isRotating = false;
    });
    
    sceneContainer.addEventListener('contextmenu', e => e.preventDefault());
    
    function expandGrid() {
        const oldSize = size;
        size = 6;
        const newCells = [];
        
        sceneContainer.style.width = `${size * spacing}px`;
        sceneContainer.style.height = `${size * spacing}px`;
        
        const center = (size - 1) / 2;
        
        for (let i = 0; i < cells.length; i++) {
            if (cells[i]) {
                const oldRow = Math.floor(i / oldSize);
                const oldCol = i % oldSize;
                
                const newRow = oldRow;
                const newCol = oldCol;
                const index = newRow * size + newCol;
                
                const x = (newCol - center) * spacing;
                const y = (newRow - center) * spacing;
                cells[i].style.transform = `translate3d(${x}px, ${y}px, 0)`;
                
                cells[i].dataset.row = newRow;
                cells[i].dataset.col = newCol;
                cells[i].dataset.index = index;
                
                const frontFace = cells[i].querySelector('.cell-front');
                if (frontFace) frontFace.dataset.index = index;
                
                newCells[index] = cells[i];
            }
        }
        
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                const index = row * size + col;
                if (!newCells[index]) {
                    newCells[index] = createCell(index, row, col);
                    newCells[index].className = `cell forest`;
                    newCells[index].dataset.state = 'forest';
                }
            }
        }
        
        cells = newCells;
        
        toolSelection.classList.add('show');
        
        setTimeout(() => {
            const houseTools = document.querySelectorAll('.house-tool');
            houseTools.forEach((tool, index) => {
                setTimeout(() => {
                    tool.classList.add('show');
                    tool.style.visibility = 'visible';
                }, index * 300);
            });
            
            const bellSound = document.getElementById('bellSound1');
            bellSound.currentTime = 0;
            bellSound.volume = 0.3;
            bellSound.play();
        }, 500);
        
        updateHighlightsForAllHouses();
        
        const forestCells = cells.filter(cell => cell && cell.dataset.state === 'forest');
        if (forestCells.length > 0) {
            boarSpawnForestIndex = forestCells[Math.floor(Math.random() * forestCells.length)].dataset.index;
        }
    }
    
    function handleCellClick(e) {
        if (e.button === 0) {
            const clickedFace = e.currentTarget;
            const index = parseInt(clickedFace.dataset.index);
            const clickedCell = cells[index];
            lastClickedIndex = index;
            
            clickedCell.classList.remove('highlight-blacksmith', 'highlight-river', 'highlight-farmer');
            
            if (currentTool === 'dirt' && clickedCell.dataset.state === 'empty') {
                const dirtSound = document.getElementById('dirtSound');
                dirtSound.currentTime = 0;
                dirtSound.play();
            }
            
            if (clickedCell.dataset.state === 'empty') {
                let cellClass, cost;
                switch(currentTool) {
                    case 'mountain':
                        if (energy < 1) return;
                        cellClass = 'mountain';
                        cost = 1;
                        break;
                    case 'river_house':
                        if (energy < 2) return;
                        cellClass = 'river_house';
                        cost = 2;
                        break;
                    case 'farmer_house':
                        if (energy < 2) return;
                        cellClass = 'farmer_house';
                        cost = 2;
                        break;
                    case 'blacksmith_house':
                        if (energy < 2) return;
                        cellClass = 'blacksmith_house';
                        cost = 2;
                        break;
                    default:
                        cellClass = 'dirt';
                        cost = 0;
                }
                
                energy -= cost;
                clickedCell.className = `cell ${cellClass}`;
                clickedCell.dataset.state = cellClass;
                createSparkles(clickedCell, cellClass);
                updateEnergyDisplay();
                
                if (['river_house', 'farmer_house', 'blacksmith_house'].includes(cellClass)) {
                    setTimeout(() => {
                        const villagerCounter = document.querySelector('.villager-counter');
                        if (!villagerCounter.classList.contains('show')) {
                            villagerCounter.classList.add('show');
                        }
                    }, 300);
                }
                
                if (['blacksmith_house', 'river_house', 'farmer_house'].includes(cellClass)) {
                    highlightAdjacentEmptyCells(index);
                }
                
                setTimeout(() => checkAdjacentCells(index), 10);
                
                if (['river_house', 'farmer_house', 'blacksmith_house', 'castle'].includes(cellClass)) {
                    setTimeout(() => checkVillagerMovementConditions(), 100);
                }
            }
            
            updateHighlightsForAllHouses();
        }
    }
    
    function checkAdjacentCells(index) {
        const row = parseInt(cells[index].dataset.row);
        const col = parseInt(cells[index].dataset.col);
        
        const directions = [{row: 0, col: 1}, {row: 1, col: 0}, {row: 0, col: -1}, {row: -1, col: 0}];
        for (const dir of directions) {
            const newRow = row + dir.row;
            const newCol = col + dir.col;
            if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size) {
                checkCellPair(index, newRow * size + newCol);
            }
        }
    }
    
    function checkCellPair(index1, index2) {
        const cell1 = cells[index1];
        const cell2 = cells[index2];
        const state1 = cell1.dataset.state;
        const state2 = cell2.dataset.state;
        
        if (state1 === state2 && state1 !== 'empty') {
            if (['river_house', 'farmer_house', 'blacksmith_house'].includes(state1)) {
                return;
            }
            
            let transformIndex, clearIndex;
            
            if (lastClickedIndex === index1) {
                transformIndex = index1;
                clearIndex = index2;
            } else if (lastClickedIndex === index2) {
                transformIndex = index2;
                clearIndex = index1;
            } else {
                transformIndex = index2;
                clearIndex = index1;
            }
            
            const transformCell = cells[transformIndex];
            const clearCell = cells[clearIndex];
            const currentState = transformCell.dataset.state;
            
            let newState, newClass, soundId, shouldReplenishEnergy = false;
            switch (currentState) {
                case 'dirt':
                    newState = 'grass';
                    newClass = 'grass';
                    soundId = 'bellSound1';
                    break;
                case 'grass':
                    newState = 'puddle';
                    newClass = 'puddle';
                    soundId = 'bellSound2';
                    break;
                case 'puddle':
                    newState = 'mountain';
                    newClass = 'mountain';
                    soundId = 'bellSound3';
                    break;
                case 'mountain':
                    newState = 'village';
                    newClass = 'village';
                    soundId = 'bellSound4';
                    shouldReplenishEnergy = true;
                    break;
                case 'village':
                    newState = 'castle';
                    newClass = 'castle';
                    soundId = 'bellSound5';
                    const energyDots = energyContainer.querySelectorAll('.energy');
                    energyDots.forEach((dot, index) => {
                        dot.style.animation = 'none';
                        void dot.offsetWidth;
                        dot.style.animation = 'pulse-energy 2s 2 ease-in-out';
                        setTimeout(() => {
                            dot.style.animation = 'pulse-energy 8s infinite ease-in-out';
                            dot.style.animationDelay = `${index * 0.8}s`;
                        }, 2000);
                    });
                    createSparkles(transformCell, newState);
                    setTimeout(() => {
                        expandGrid();
                        checkVillagerMovementConditions();
                        setTimeout(spawnBoar, 1000);
                    }, 300);
                    break;
                case 'castle':
                    return;
                default:
                    return;
            }
            
            if (shouldReplenishEnergy) {
                energy = 5;
                updateEnergyDisplay();
            }
            
            if (currentSound) {
                currentSound.pause();
                currentSound.currentTime = 0;
            }
            currentSound = document.getElementById(soundId);
            currentSound.play();
            
            transformCell.className = `cell ${newClass}`;
            transformCell.dataset.state = newState;
            clearCell.className = 'cell empty';
            clearCell.dataset.state = 'empty';
            
            transformCell.style.transform += ' translateZ(50px)';
            setTimeout(() => {
                transformCell.style.transform = transformCell.style.transform.replace(' translateZ(50px)', '');
            }, 300);
            
            createSparkles(transformCell, newState);
            
            if (newState === 'castle') {
                setTimeout(() => {
                    expandGrid();
                    checkVillagerMovementConditions();
                    setTimeout(spawnBoar, 2000);
                }, 300);
            }
            
            setTimeout(() => {
                checkAdjacentCells(transformIndex);
                checkAdjacentCells(clearIndex);
                updateHighlightsForAllHouses();
            }, 10);
        }
    }

    setTimeout(() => {
        checkVillagerMovementConditions();
    }, 1000);
});

function createResourceDisplay() {
    const resourceContainer = document.createElement('div');
    resourceContainer.className = 'resource-container';
    
    resourceContainer.innerHTML = `
        <div class="resource food">
            <span class="resource-icon">🍎</span>
            <span id="foodCount">${gameState.resources.food}</span>
        </div>
        <div class="resource materials">
            <span class="resource-icon">🪵</span>
            <span id="materialsCount">${gameState.resources.materials}</span>
        </div>
        <div class="resource energy">
            <span class="resource-icon">⚡</span>
            <span id="energyCount">${gameState.resources.energy}</span>
        </div>
    `;
    
    document.body.appendChild(resourceContainer);
}

function createUpgradeButtons() {
    const upgradeContainer = document.createElement('div');
    upgradeContainer.className = 'upgrade-container';
    
    upgradeContainer.innerHTML = `
        <button id="upgradeHouses" class="upgrade-btn">
            Upgrade Houses (<span id="upgradeHousesCost">${gameState.upgrades.houses.cost}</span>)
        </button>
        <button id="upgradePaths" class="upgrade-btn">
            Upgrade Paths (<span id="upgradePathsCost">${gameState.upgrades.paths.cost}</span>)
        </button>
    `;
    
    document.body.appendChild(upgradeContainer);
    
    document.getElementById('upgradeHouses').addEventListener('click', upgradeHouses);
    document.getElementById('upgradePaths').addEventListener('click', upgradePaths);
}

function upgradeHouses() {
    if (gameState.resources.materials >= gameState.upgrades.houses.cost) {
        gameState.resources.materials -= gameState.upgrades.houses.cost;
        gameState.upgrades.houses.level += 1;
        gameState.upgrades.houses.cost = Math.floor(gameState.upgrades.houses.cost * 1.5);
        
        // Visual upgrade
        document.querySelectorAll('.cell[data-state$="_house"]').forEach(house => {
            house.style.boxShadow = `0 0 20px ${getHouseColor(house.dataset.state)}`;
        });
        
        showNotification(`Houses Upgraded to Level ${gameState.upgrades.houses.level}!`);
        updateResourceDisplay();
    }
}

function upgradePaths() {
    if (gameState.resources.materials >= gameState.upgrades.paths.cost) {
        gameState.resources.materials -= gameState.upgrades.paths.cost;
        gameState.upgrades.paths.level += 1;
        gameState.upgrades.paths.cost = Math.floor(gameState.upgrades.paths.cost * 1.5);
        
        // Increase villager speed
        showNotification(`Paths Upgraded to Level ${gameState.upgrades.paths.level}!`);
        updateResourceDisplay();
    }
}

// ========== UI UPDATES ==========
function updateResourceDisplay() {
    document.getElementById('foodCount').textContent = Math.floor(gameState.resources.food);
    document.getElementById('materialsCount').textContent = Math.floor(gameState.resources.materials);
    document.getElementById('energyCount').textContent = Math.floor(gameState.resources.energy);
    
    document.getElementById('upgradeHousesCost').textContent = gameState.upgrades.houses.cost;
    document.getElementById('upgradePathsCost').textContent = gameState.upgrades.paths.cost;
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 1000);
    }, 3000);
}

// ========== ENHANCED BOAR BEHAVIOR ==========
function updateBoarBehavior() {
    document.querySelectorAll('.boar').forEach(boar => {
        if (boar.dataset.state === 'idle' && Math.random() < 0.3) {
            // Boars sometimes target villagers
            const villagers = document.querySelectorAll('.villager');
            if (villagers.length > 0) {
                const target = villagers[Math.floor(Math.random() * villagers.length)];
                boar.dataset.state = 'hunting';
                boar.dataset.target = target.dataset.id;
                moveBoarToTarget(boar, target);
            }
        }
    });
}

function moveBoarToTarget(boar, target) {
    // Simplified pathfinding to target
    const boarRect = boar.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    
    const dx = targetRect.left - boarRect.left;
    const dy = targetRect.top - boarRect.top;
    
    boar.style.transition = 'left 1.5s linear, top 1.5s linear';
    boar.style.left = `${parseFloat(boar.style.left) + dx}px`;
    boar.style.top = `${parseFloat(boar.style.top) + dy}px`;
    
    boar.addEventListener('transitionend', function onEnd() {
        boar.removeEventListener('transitionend', onEnd);
        
        // Chance to knock back villager
        if (Math.random() < 0.7) {
            const resilience = parseFloat(target.dataset.resilience) || 1;
            if (Math.random() > resilience * 0.5) {
                // Villager is knocked back
                const knockbackX = dx > 0 ? -50 : 50;
                const knockbackY = dy > 0 ? -30 : 30;
                
                target.style.transition = 'left 0.5s ease-out, top 0.5s ease-out';
                target.style.left = `${parseFloat(target.style.left) + knockbackX}px`;
                target.style.top = `${parseFloat(target.style.top) + knockbackY}px`;
                
                setTimeout(() => {
                    target.style.transition = '';
                    // Villager needs to find path again
                    const villagerId = target.dataset.id;
                    const path = villagers.get(villagerId)?.path;
                    if (path) {
                        moveEntity(target, path, 'villager');
                    }
                }, 500);
            }
        }
        
        boar.dataset.state = 'idle';
        setTimeout(() => wanderBoar(boar, findCellIndexUnderElement(boar)), 2000);
    });
}

// ========== ENHANCED VILLAGER SYSTEM ==========
function createVillagerForHouse(houseIndex) {
    const cell = cells[houseIndex];
    if (!cell) return null;
    
    const houseType = cell.dataset.state.split('_')[0];
    const villagerType = getRandomVillagerType();
    
    const villager = document.createElement('div');
    villager.className = `villager ${villagerType}`;
    villager.dataset.type = villagerType;
    villager.dataset.resilience = gameConfig.villagerTypes[villagerType].resilience;
    
    positionEntityOnCell(villager, cell);
    
    // Different appearance for different types
    switch(villagerType) {
        case 'fast':
            villager.style.filter = 'hue-rotate(120deg)';
            break;
        case 'strong':
            villager.style.transform = 'scale(1.2)';
            break;
        case 'wise':
            villager.style.filter = 'hue-rotate(240deg)';
            break;
    }
    
    // Play sound
    const sound = document.getElementById('villagerSound').cloneNode();
    sound.play();
    
    return villager;
}

function getRandomVillagerType() {
    const types = Object.keys(gameConfig.villagerTypes);
    const weights = {
        normal: 60,
        fast: 20,
        strong: 15,
        wise: 5
    };
    
    let total = 0;
    for (const type of types) {
        total += weights[type];
    }
    
    let random = Math.random() * total;
    for (const type of types) {
        if (random < weights[type]) {
            return type;
        }
        random -= weights[type];
    }
    
    return 'normal';
}

// ========== ENHANCED GAME LOOP ==========
function startGameLoop() {
    // Main game timer
    const gameTimer = setInterval(() => {
        gameState.gameTime += 1000;
        
        // Difficulty scaling
        if (gameState.gameTime % gameConfig.difficultyScaling.interval === 0) {
            increaseDifficulty();
        }
        
        // Random events
        if (gameState.gameTime % gameConfig.events.interval === 0) {
            triggerRandomEvent();
        }
        
        // Resource generation
        generateResources();
        
    }, 1000);

    // Villager movement loop (more frequent)
    const movementLoop = setInterval(() => {
        checkAndMoveVillagers();
        updateBoarBehavior();
        checkActiveEvents();
    }, 500);

    // Cleanup when game ends
    return () => {
        clearInterval(gameTimer);
        clearInterval(movementLoop);
    };
}

function increaseDifficulty() {
    gameState.difficulty += 1;
    gameConfig.maxBoars += gameConfig.difficultyScaling.boarIncrease;
    
    // Play warning sound
    const warningSound = document.getElementById('bellSound1');
    warningSound.currentTime = 0;
    warningSound.play();
    
    // Show difficulty increase notification
    showNotification(`Difficulty Increased! (Level ${gameState.difficulty})`);
}

function triggerRandomEvent() {
    const eventType = gameConfig.events.possibleEvents[
        Math.floor(Math.random() * gameConfig.events.possibleEvents.length)
    ];
    
    let duration = 30000; // 30 seconds
    let message = "";
    
    switch(eventType) {
        case 'rain':
            message = "Heavy Rain! Villagers move slower.";
            gameState.activeEvents.push({
                type: 'rain',
                effect: () => {
                    document.querySelectorAll('.villager').forEach(v => {
                        v.style.animationDuration = `${800 * gameState.difficulty}ms`;
                    });
                },
                cleanup: () => {
                    document.querySelectorAll('.villager').forEach(v => {
                        v.style.animationDuration = `${500 * gameState.difficulty}ms`;
                    });
                },
                duration: duration
            });
            break;
            
        case 'festival':
            message = "Village Festival! Energy replenishes faster.";
            gameState.resources.energy += 2;
            updateEnergyDisplay();
            break;
            
        case 'plague':
            message = "Plague! Some villagers may perish.";
            gameState.activeEvents.push({
                type: 'plague',
                effect: () => {
                    if (Math.random() < 0.1) {
                        const villagers = Array.from(villagers.keys());
                        if (villagers.length > 0) {
                            const randomIndex = Math.floor(Math.random() * villagers.length);
                            const villager = villagers.get(villagers[randomIndex]);
                            if (villager && villager.parentNode) {
                                villager.parentNode.removeChild(villager);
                                villagers.delete(villagers[randomIndex]);
                                gameState.villagersRemaining--;
                                updateVillagerCounter();
                            }
                        }
                    }
                },
                duration: duration
            });
            break;
            
        case 'earthquake':
            message = "Earthquake! Some paths may be destroyed.";
            gameState.activeEvents.push({
                type: 'earthquake',
                effect: () => {
                    if (Math.random() < 0.15) {
                        const dirtCells = cells.filter(c => c && c.dataset.state === 'dirt');
                        if (dirtCells.length > 0) {
                            const randomCell = dirtCells[Math.floor(Math.random() * dirtCells.length)];
                            randomCell.className = 'cell empty';
                            randomCell.dataset.state = 'empty';
                            createSparkles(randomCell, 'empty');
                        }
                    }
                },
                duration: duration
            });
            break;
    }
    
    showNotification(message);
    playEventSound(eventType);
}

function checkActiveEvents() {
    const now = Date.now();
    gameState.activeEvents = gameState.activeEvents.filter(event => {
        if (now - event.startTime > event.duration) {
            if (event.cleanup) event.cleanup();
            return false;
        }
        if (event.effect) event.effect();
        return true;
    });
}

function generateResources() {
    // Generate resources based on houses
    const houses = cells.filter(c => c && c.dataset.state.endsWith('_house'));
    
    houses.forEach(house => {
        const type = house.dataset.state.split('_')[0];
        switch(type) {
            case 'farmer':
                gameState.resources.food += 0.5 * gameState.upgrades.houses.level;
                break;
            case 'river':
                gameState.resources.materials += 0.3 * gameState.upgrades.houses.level;
                break;
            case 'blacksmith':
                gameState.resources.energy += 0.1 * gameState.upgrades.houses.level;
                break;
        }
    });
    
    updateResourceDisplay();
}