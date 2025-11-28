// Système de notification mélodieuse pour les pauses
(function() {
    let audioContext = null;
    let notificationPlaying = false;
    
    function initAudioContext() {
        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.log('Audio non disponible pour les notifications');
                return null;
            }
        }
        return audioContext;
    }
    
    function playMelodiousNotification() {
        if (notificationPlaying) return; // Éviter les doublons
        
        const ctx = initAudioContext();
        if (!ctx) return;
        
        notificationPlaying = true;
        
        // Mélodie agréable de 5 secondes
        // Séquence harmonieuse : Do-Mi-Sol-Do (montée) puis descente douce
        const melody = [
            { freq: 523.25, duration: 0.4, time: 0 },      // C5
            { freq: 659.25, duration: 0.4, time: 0.5 },   // E5
            { freq: 783.99, duration: 0.4, time: 1.0 },   // G5
            { freq: 1046.50, duration: 0.5, time: 1.5 }, // C6 (pic)
            { freq: 783.99, duration: 0.4, time: 2.2 },   // G5
            { freq: 659.25, duration: 0.4, time: 2.7 },   // E5
            { freq: 523.25, duration: 0.4, time: 3.2 },   // C5
            { freq: 392.00, duration: 0.6, time: 3.7 },  // G4 (fin douce)
        ];
        
        melody.forEach(note => {
            setTimeout(() => {
                const oscillator = ctx.createOscillator();
                const gainNode = ctx.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(ctx.destination);
                
                oscillator.frequency.value = note.freq;
                oscillator.type = 'sine';
                
                // Enveloppe ADSR douce
                const startTime = ctx.currentTime;
                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
                gainNode.gain.linearRampToValueAtTime(0.15, startTime + note.duration * 0.7);
                gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + note.duration);
                
                oscillator.start(startTime);
                oscillator.stop(startTime + note.duration);
            }, note.time * 1000);
        });
        
        // Réinitialiser après la fin de la mélodie
        setTimeout(() => {
            notificationPlaying = false;
        }, 5000);
    }
    
    // Exposer la fonction globalement
    window.notificationSound = {
        play: playMelodiousNotification,
        isPlaying: () => notificationPlaying
    };
})();

