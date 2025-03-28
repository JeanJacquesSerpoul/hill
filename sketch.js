// --- Variables Globales ---
let ball;
let groundPoints = []; // Points définissant la surface de la colline/trou
let gravity;
let friction = 0.99; // Facteur de ralentissement (proche de 1 = peu de friction)
let restitution = 0.4; // Élasticité lors du rebond (0 = pas de rebond, 1 = rebond parfait)

// Paramètres de la colline et du trou
let hillBaseLevel;
let hillPeakHeight = 150; // Hauteur max de la colline par rapport à la base
let holeCenterRatio = 0.7; // Position horizontale du trou (0.7 = 70% de la largeur)
let holeWidth = 50;
let holeDepth = 30;
let controlPoints = []; // Pour une courbe plus lisse (Bezier)

// Contrôle du lancer
let isDragging = false;
let dragStartPos = null;
let launchForceScale = 0.15; // Multiplicateur pour la force du lancer
let maxLaunchSpeed = 15;

// États du jeu
let gameState = 'aiming'; // 'aiming', 'launching', 'inAir', 'landed', 'won', 'failed'
let message = "Faites glisser la boule pour lancer";

// Sliders pour les contrôles
let hillHeightSlider, holeDepthSlider, holeWidthSlider;

// --- Fonctions p5.js ---

function setup() {
    let canvasContainer = select('#game-container');
    // Créer un canvas qui essaie de remplir la fenêtre mais avec des limites
    let canvasWidth = min(windowWidth * 0.95, 800);
    let canvasHeight = min(windowHeight * 0.8, 600);
    let cnv = createCanvas(canvasWidth, canvasHeight);
    cnv.parent(canvasContainer); // Attache le canvas au div 'game-container'

    gravity = createVector(0, 0.2); // Augmenté légèrement pour plus de "poids"
    hillBaseLevel = height * 0.8; // Niveau de base de la colline

    // Initialisation des sliders
    hillHeightSlider = select('#hillHeightSlider');
    holeDepthSlider = select('#holeDepthSlider');
    holeWidthSlider = select('#holeWidthSlider');

    // Associer les fonctions de mise à jour aux événements 'input' des sliders
    hillHeightSlider.input(updateHillParameters);
    holeDepthSlider.input(updateHillParameters);
    holeWidthSlider.input(updateHillParameters);

    // Lire les valeurs initiales des sliders
    updateHillParameters(); // Génère la colline initiale

    // Initialiser la boule
    resetBall();

    // Style graphique
    strokeWeight(2); // Épaisseur des lignes
}

function draw() {
    // Fond (dégradé ciel)
    drawSkyGradient();

    // Dessiner la colline
    drawHill();

    // Mettre à jour et dessiner la boule
    if (gameState !== 'aiming' && gameState !== 'landed') {
        ball.applyForce(gravity);
        ball.update();
        checkCollisions();
    }
    ball.draw();

    // Dessiner l'indicateur de lancer si on vise
    if (isDragging) {
        drawLaunchIndicator();
    }

    // Afficher les messages d'état
    drawMessage();
}

// --- Fonctions de jeu ---

function resetBall() {
    // Position initiale de la boule (en bas à gauche)
    let startX = width * 0.1;

    // --- Calculer startY basé sur le sol réel ---
    let groundYAtStart = getGroundY(startX); // Obtient la hauteur du sol à startX
    // Mesure de sécurité : si getGroundY ne trouve rien
    if (groundYAtStart >= height || typeof groundYAtStart === 'undefined') { // Vérif plus robuste
        console.warn("Could not determine ground Y at start, using hillBaseLevel as fallback.");
        groundYAtStart = hillBaseLevel;
    }
    // On place le CENTRE de la balle un peu au-dessus du sol
    // Utilise la valeur numérique 10 pour le rayon + 5 pour l'espace
    let startY = groundYAtStart - 10 - 5; // = groundYAtStart - 15

    // --- Fin de la modification ---

    // Assurez-vous que la balle est créée APRES le calcul de startY
    // Si 'ball' n'existe pas encore (tout premier appel), créez-la
    if (!ball) {
        ball = new Ball(startX, startY, 10); // Rayon 10
    } else {
        // Si elle existe déjà, réinitialisez simplement ses propriétés
        ball.pos.set(startX, startY);
        ball.velocity.set(0, 0);
        ball.acceleration.set(0, 0);
    }

    gameState = 'aiming';
    message = "Faites glisser la boule pour lancer";
}
function updateHillParameters() {
    hillPeakHeight = parseFloat(hillHeightSlider.value());
    holeDepth = parseFloat(holeDepthSlider.value());
    holeWidth = parseFloat(holeWidthSlider.value());
    generateHill();
    // Si la balle était posée, la replacer correctement
    if (gameState === 'aiming' || gameState === 'landed') {
         resetBall(); // Le plus simple est de la remettre au début
    }
}


function generateHill() {
    groundPoints = [];
    controlPoints = []; // Réinitialiser les points de contrôle pour Bezier

    let noiseScale = 0.005; // Pour un terrain un peu irrégulier
    let step = 5; // Résolution de la courbe du sol

    // Points de contrôle pour la courbe de Bézier
    let cp1 = createVector(0, hillBaseLevel);
    let cp2 = createVector(width * 0.3, hillBaseLevel - hillPeakHeight * 0.8 + noise(100) * 20);
    let cp3 = createVector(width * holeCenterRatio, hillBaseLevel - hillPeakHeight + noise(200) * 15); // Point avant le trou
    let cp4 = createVector(width * (holeCenterRatio + 0.1), hillBaseLevel - hillPeakHeight * 0.9 + noise(300) * 20); // Point après le trou (approximatif)
    let cp5 = createVector(width, hillBaseLevel); // Fin de la colline

    // Générer les points de la courbe principale (sans le trou pour l'instant)
    // Section 1: Début à avant le trou
    for (let t = 0; t <= 1; t += 0.02) { // Augmenter les points pour la précision de collision
        let x = bezierPoint(cp1.x, cp2.x, cp3.x, cp3.x, t); // Utilise cp3 deux fois pour s'arrêter là
        let y = bezierPoint(cp1.y, cp2.y, cp3.y, cp3.y, t);
        // Ajouter une petite variation avec noise()
        y += (noise(x * noiseScale) - 0.5) * 30;
        groundPoints.push(createVector(x, y));
    }

    // Définir le centre exact du trou et ses bords
    let holeCenterX = width * holeCenterRatio;
    let holeLeftX = holeCenterX - holeWidth / 2;
    let holeRightX = holeCenterX + holeWidth / 2;
    let hillYAtHoleCenter = bezierPoint(cp1.y, cp2.y, cp3.y, cp4.y, holeCenterRatio); // Approx Y sans trou
        hillYAtHoleCenter += (noise(holeCenterX * noiseScale) - 0.5) * 30; // Ajouter le noise

    // Filtrer les points existants pour faire de la place au trou
     groundPoints = groundPoints.filter(p => p.x < holeLeftX);

    // Ajouter les points du trou
    groundPoints.push(createVector(holeLeftX, hillYAtHoleCenter)); // Bord gauche
    groundPoints.push(createVector(holeLeftX + holeWidth * 0.1, hillYAtHoleCenter + holeDepth * 0.5)); // Pente entrée
    groundPoints.push(createVector(holeCenterX, hillYAtHoleCenter + holeDepth)); // Fond du trou
    groundPoints.push(createVector(holeRightX - holeWidth * 0.1, hillYAtHoleCenter + holeDepth * 0.5)); // Pente sortie
    groundPoints.push(createVector(holeRightX, hillYAtHoleCenter)); // Bord droit

     // Section 2: Après le trou jusqu'à la fin
    for (let t = 0; t <= 1; t += 0.02) {
        let x = bezierPoint(cp4.x, cp4.x, cp5.x, cp5.x, t); // Utilise cp4 deux fois pour démarrer de là
        let y = bezierPoint(cp4.y, cp4.y, cp5.y, cp5.y, t);
         y += (noise(x * noiseScale) - 0.5) * 30;
        // Ajouter seulement si x est après le trou pour éviter les doublons
        if (x > holeRightX + step) { // +step pour éviter chevauchement exact
             groundPoints.push(createVector(x, y));
        }
    }

    // Trier les points par x au cas où l'ordre serait incorrect
    groundPoints.sort((a, b) => a.x - b.x);

    // Assurer que le premier point est à x=0 et le dernier à x=width
     if (groundPoints.length > 0) {
         groundPoints.unshift(createVector(0, groundPoints[0].y)); // Ajoute au début
         groundPoints.push(createVector(width, groundPoints[groundPoints.length-1].y)); // Ajoute à la fin
     } else {
         // Fallback si tout a échoué
         groundPoints.push(createVector(0, hillBaseLevel));
         groundPoints.push(createVector(width, hillBaseLevel));
     }
    // S'assurer qu'il y a un sol plat au début pour la balle
    groundPoints.splice(1, 0, createVector(width * 0.15, groundPoints[0].y)); // Ajoute un point plat après le départ


    // Lisser les points du trou pour éviter les angles vifs
    // (Optionnel, mais améliore la physique)
    // On pourrait utiliser curveVertex ici ou un algorithme de lissage
}


function drawHill() {
    noStroke();
    // Remplissage de la colline (dégradé vert)
    let green1 = color(34, 139, 34); // ForestGreen
    let green2 = color(85, 107, 47); // DarkOliveGreen
    for (let y = 0; y < height; y++) {
        let inter = map(y, hillBaseLevel - hillPeakHeight - 50, height, 0, 1);
        let c = lerpColor(green1, green2, inter);
        // Dessine une ligne horizontale seulement en dessous de la courbe du sol
        let groundY = getGroundY(width / 2); // Juste pour une référence, pas parfait
         if (y > groundY - 50) { // Optimisation: ne dessine le dégradé que près/sous la colline
             // stroke(c);
             // line(0, y, width, y);
         }
    }
     // Dessiner la forme de la colline
    fill(green1); // Couleur principale
    stroke(47, 79, 79); // DarkSlateGray pour le contour
    strokeWeight(3);
    beginShape();
    vertex(0, height); // Coin inférieur gauche
    vertex(0, groundPoints[0].y); // Point de départ de la colline à gauche
    for (let p of groundPoints) {
        curveVertex(p.x, p.y); // Utiliser curveVertex pour lisser si generateHill ne le fait pas assez
         // vertex(p.x, p.y); // Utiliser vertex pour des lignes droites entre les points
    }
     vertex(width, groundPoints[groundPoints.length-1].y); // Dernier point à droite
    vertex(width, height); // Coin inférieur droit
    endShape(CLOSE);
    noStroke();
}

function drawSkyGradient() {
    let sky1 = color(135, 206, 250); // LightSkyBlue
    let sky2 = color(240, 248, 255); // AliceBlue (près de l'horizon)
    for (let y = 0; y < height; y++) {
        let inter = map(y, 0, height * 0.8, 0, 1); // Dégradé sur 80% de la hauteur
        let c = lerpColor(sky1, sky2, inter);
        stroke(c);
        line(0, y, width, y);
    }
    noStroke(); // Réinitialiser noStroke
}


function getGroundY(x) {
    // Trouve le segment de sol sous la coordonnée x
    for (let i = 0; i < groundPoints.length - 1; i++) {
        let p1 = groundPoints[i];
        let p2 = groundPoints[i + 1];
        if (x >= p1.x && x <= p2.x) {
            // Interpolation linéaire entre p1.y et p2.y
            let t = map(x, p1.x, p2.x, 0, 1);
            return lerp(p1.y, p2.y, t);
        }
    }
    // Si x est en dehors des limites (avant le premier ou après le dernier point)
    if (x < groundPoints[0].x) return groundPoints[0].y;
    if (x > groundPoints[groundPoints.length - 1].x) return groundPoints[groundPoints.length - 1].y;

    return height; // Retourne le bas si rien n'est trouvé (ne devrait pas arriver)
}

function getGroundSegment(x) {
    // Trouve le segment de sol (p1, p2) sous la coordonnée x
     for (let i = 0; i < groundPoints.length - 1; i++) {
        let p1 = groundPoints[i];
        let p2 = groundPoints[i + 1];
        // Vérifie si x est dans ce segment (ou très proche pour éviter les erreurs de flottants)
        if (x >= p1.x - 0.1 && x <= p2.x + 0.1) {
            return { p1: p1, p2: p2, index: i };
        }
    }
    // Gérer les cas extrêmes
    if (x < groundPoints[0].x) return { p1: groundPoints[0], p2: groundPoints[1], index: 0 };
    if (x > groundPoints[groundPoints.length - 1].x) return { p1: groundPoints[groundPoints.length - 2], p2: groundPoints[groundPoints.length - 1], index: groundPoints.length - 2 };

    return null; // Ne devrait pas arriver si x est dans le canvas
}


function checkCollisions() {
    if (!ball || gameState === 'won') return; // Ne pas vérifier si gagné ou balle non définie

    let segmentInfo = getGroundSegment(ball.pos.x);
    if (!segmentInfo) return; // Pas de segment trouvé

    let p1 = segmentInfo.p1;
    let p2 = segmentInfo.p2;

    // Calculer la hauteur du sol interpolée à la position x de la balle
    let groundY = getGroundY(ball.pos.x);

    // Détection de collision simple (bas de la balle touche le sol)
    if (ball.pos.y + ball.radius >= groundY) {

        // 1. Correction de la position pour éviter l'enfoncement
        ball.pos.y = groundY - ball.radius;

        // 2. Calculer la normale à la surface du segment
        let segmentVector = p5.Vector.sub(p2, p1);
        let surfaceAngle = segmentVector.heading(); // Angle du segment par rapport à l'horizontale
        // La normale est perpendiculaire au segment, pointant vers le "haut"
        let normalAngle = surfaceAngle - HALF_PI;
        let normalVector = p5.Vector.fromAngle(normalAngle);

        // Si la normale pointe vers le bas (surface en surplomb?), inverser.
        // Ceci est une simplification, assume que le sol est toujours "sous" la balle.
        if (normalVector.y > 0) {
           // normalVector.mult(-1); // Ne devrait pas être nécessaire avec une colline simple
        }

        // 3. Calculer la réponse à la collision (Rebond + Friction)
        let velocityNormal = p5.Vector.dot(ball.velocity, normalVector); // Projection de la vitesse sur la normale

        // Si la balle va déjà dans le sens opposé à la normale (s'éloigne), ne rien faire
        if (velocityNormal > 0) {
           // return; // Ou peut-être juste appliquer la friction tangentielle ?
        }

        // Vitesse de réflexion (composante normale)
        let reflection = normalVector.copy();
        reflection.mult(-2 * velocityNormal); // Inverser la composante normale
        //reflection.mult(restitution); // Appliquer l'élasticité (0 = pas de rebond normal)

        // Ajouter la réflexion à la vitesse actuelle (incorrect, il faut séparer normale/tangentielle)
        // Décomposition correcte: V' = V - (1 + e) * (V . N) * N + Friction_tangentielle
        let newVel = p5.Vector.sub(ball.velocity, p5.Vector.mult(normalVector, (1 + restitution) * velocityNormal));


        // 4. Appliquer la friction (ralentissement tangentiel)
        // La friction dépend de la composante tangentielle de la vitesse
         let tangentVector = createVector(normalVector.y, -normalVector.x); // Perpendiculaire à la normale
         let velocityTangent = p5.Vector.dot(newVel, tangentVector);
         let frictionForce = tangentVector.copy().mult(velocityTangent).mult(1 - friction); // Force opposée au mouvement tangentiel

        // Appliquer la nouvelle vitesse et la friction
        ball.velocity = newVel.mult(friction); // Application simplifiée de la friction sur l'ensemble


        // Vérifier si la balle est dans le trou
        let holeCenterX = width * holeCenterRatio;
        let distToHoleCenter = abs(ball.pos.x - holeCenterX);
        let targetY = hillBaseLevel - hillPeakHeight + holeDepth; // Y au fond du trou

        if (distToHoleCenter < holeWidth / 3 && // Dans la zone centrale du trou
            ball.pos.y > targetY - ball.radius * 2 && // Assez bas
            ball.velocity.magSq() < 0.5) // Presque arrêtée
           {
            gameState = 'won';
            message = "Bravo ! Dans le trou !";
            ball.velocity.set(0, 0); // Arrêter complètement
            // Optionnel: Centrer la balle dans le trou
            ball.pos.x = holeCenterX;
            ball.pos.y = targetY - ball.radius;
        }
        // Vérifier si la balle s'est arrêtée ailleurs (échec)
        else if (ball.velocity.magSq() < 0.05 && gameState !== 'won') { // Si la vitesse est très faible
            // Vérifier si elle est sur une pente ou à plat
            if (abs(segmentVector.angleBetween(createVector(1,0))) < 0.1) { // Sur surface quasi-horizontale
                 gameState = 'failed';
                 message = "Échoué. Cliquez pour réessayer.";
            } else {
                // Sur une pente, elle devrait continuer à glisser un peu (la friction gère ça)
                // Mais si elle s'arrête VRAIMENT, c'est un échec
                 if (ball.velocity.magSq() < 0.01) {
                      gameState = 'failed';
                      message = "Échoué. Cliquez pour réessayer.";
                 }
            }
        }
    }

    // Vérifier les limites du canvas (gauche/droite)
    if (ball.pos.x - ball.radius < 0 || ball.pos.x + ball.radius > width) {
        // Rebondir sur les murs verticaux (ou simplement échouer)
        // ball.velocity.x *= -restitution; // Rebond
        // ball.pos.x = constrain(ball.pos.x, ball.radius, width - ball.radius); // Corriger position
         if (gameState !== 'won') {
             gameState = 'failed';
             message = "Hors limites ! Cliquez pour réessayer.";
             ball.velocity.set(0,0); // Arrêter la balle
         }
    }
}


function drawLaunchIndicator() {
    let currentMousePos = createVector(mouseX, mouseY);
    // Vecteur allant du début du drag vers la position actuelle
    let dragVector = p5.Vector.sub(currentMousePos, dragStartPos);
    // La force de lancement est opposée au vecteur de drag
    let launchVector = dragVector.copy().mult(-1);
    launchVector.mult(launchForceScale); // Appliquer l'échelle
    launchVector.limit(maxLaunchSpeed); // Limiter la vitesse max

    // Dessiner la ligne d'indicateur
    push(); // Isoler les styles
    stroke(255, 0, 0, 150); // Rouge transparent
    strokeWeight(3);
    translate(ball.pos.x, ball.pos.y); // Origine sur la balle
    line(0, 0, launchVector.x * 5, launchVector.y * 5); // Dessine une ligne proportionnelle à la force
    // Dessiner une petite flèche au bout
    let angle = launchVector.heading();
    translate(launchVector.x * 5, launchVector.y * 5);
    rotate(angle);
    fill(255,0,0, 150);
    triangle(0, 0, -8, 4, -8, -4);
    pop(); // Restaurer les styles
}

function drawMessage() {
    push();
    textAlign(CENTER, TOP);
    textSize(20);
    fill(0, 0, 0, 180); // Noir semi-transparent
    text(message, width / 2, 20);

     if (gameState === 'won' || gameState === 'failed') {
         textSize(16);
         text("Cliquez pour rejouer", width / 2, 50);
     }
    pop();
}


// --- Classe Ball ---

class Ball {
    constructor(x, y, r) {
        this.pos = createVector(x, y);
        this.velocity = createVector(0, 0);
        this.acceleration = createVector(0, 0);
        this.radius = r;
        this.mass = this.radius * 0.1; // La masse affecte la force, pas directement la gravité ici
        this.color = color(255, 100, 100); // Couleur de la balle
    }

    applyForce(force) {
        // Acceleration = Force / Masse
        let f = p5.Vector.div(force, this.mass);
        this.acceleration.add(f);
    }

    update() {
        // Mouvement physique standard (Euler integration)
        this.velocity.add(this.acceleration);
        this.pos.add(this.velocity);
        // Réinitialiser l'accélération à chaque frame (les forces sont appliquées à nouveau)
        this.acceleration.mult(0);
    }

    draw() {
        fill(this.color);
        stroke(180, 70, 70); // Contour plus sombre
        strokeWeight(1);
        ellipse(this.pos.x, this.pos.y, this.radius * 2, this.radius * 2);
    }
}

// --- Gestion des entrées utilisateur ---

function mousePressed() {
    // Ignorer si clic sur les sliders (approximatif)
    if (mouseY > height - 50 && mouseX < 200) {
        return;
    }

    if (gameState === 'won' || gameState === 'failed') {
        resetBall();
        updateHillParameters(); // Regénérer la colline au cas où les sliders ont changé
        return;
    }

    // Vérifier si le clic est sur ou près de la balle pour commencer le lancer
    let d = dist(mouseX, mouseY, ball.pos.x, ball.pos.y);
    if (gameState === 'aiming' && d < ball.radius * 3) { // Tolérance autour de la balle
        isDragging = true;
        dragStartPos = createVector(mouseX, mouseY);
        message = "Relâchez pour lancer !";
    }
}

function mouseDragged() {
    if (isDragging) {
        // L'indicateur est dessiné dans draw()
    }
}

function mouseReleased() {
    if (isDragging) {
        isDragging = false;
        let currentMousePos = createVector(mouseX, mouseY);
        let dragVector = p5.Vector.sub(currentMousePos, dragStartPos);
        // La force de lancement est opposée au vecteur de drag
        let launchVector = dragVector.copy().mult(-1);
        launchVector.mult(launchForceScale); // Appliquer l'échelle
        launchVector.limit(maxLaunchSpeed); // Limiter la vitesse max

        ball.velocity = launchVector; // Appliquer la vitesse initiale
        gameState = 'inAir'; // Changer l'état du jeu
        message = ""; // Effacer le message d'instruction
    }
}

// Gérer aussi les événements tactiles pour mobile
function touchStarted() {
    // Empêche le comportement par défaut (scrolling, zoom) si le toucher est sur le canvas
     if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
        mousePressed(); // Simule un clic de souris
        return false; // Indique que l'événement a été géré
     }
}

function touchMoved() {
     if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
        mouseDragged(); // Simule
        return false;
     }
}

function touchEnded() {
     if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
        mouseReleased(); // Simule
        return false;
     }
}


// Gérer le redimensionnement de la fenêtre (simple recréation)
function windowResized() {
    let canvasWidth = min(windowWidth * 0.95, 800);
    let canvasHeight = min(windowHeight * 0.8, 600);
    resizeCanvas(canvasWidth, canvasHeight);
    hillBaseLevel = height * 0.8;
    updateHillParameters(); // Regénérer la colline avec les nouvelles dimensions
    resetBall(); // Replacer la balle
}