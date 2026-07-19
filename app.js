/**
 * LifeSync 2.0 - Core Application Logic
 * Service-oriented architectural client with Offline-First IndexedDB database,
 * Speech engines, Local NLP intent parser, and dynamic SVG chart renderer.
 */

// Global state variables
let db = null;
let currentView = 'home';
let recognition = null;
let isListening = false;
let audioContext = null;
let confettiParticles = [];
let confettiAnimationId = null;

// Predefined categories for mapping
const EXPENSE_CATEGORIES = [
  { id: 'food', name: 'Food', icon: 'restaurant', color: '#7C3AED' },
  { id: 'shop', name: 'Shopping', icon: 'shopping_bag', color: '#F59E0B' },
  { id: 'travel', name: 'Travel', icon: 'directions_car', color: '#22C55E' },
  { id: 'bills', name: 'Bills', icon: 'electric_bolt', color: '#EF4444' },
  { id: 'health', name: 'Health', icon: 'fitness_center', color: '#3B82F6' },
  { id: 'fun', name: 'Fun', icon: 'movie', color: '#EC4899' },
  { id: 'friends', name: 'Friends', icon: 'group', color: '#10B981' },
  { id: 'others', name: 'Others', icon: 'more_horiz', color: '#6B7280' }
];

const INCOME_CATEGORIES = [
  { id: 'salary', name: 'Salary', icon: 'work' },
  { id: 'freelance', name: 'Freelancing', icon: 'terminal' },
  { id: 'business', name: 'Business', icon: 'store' },
  { id: 'gift', name: 'Gift', icon: 'featured_seasonal' },
  { id: 'other', name: 'Other', icon: 'add_card' }
];

/* ==========================================
   DATABASE LAYER (IndexedDB Core)
   ========================================== */
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('LifeSyncDB', 1);

    request.onerror = (e) => {
      console.error('Database failed to open:', e);
      reject(e);
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      console.log('Database initialized successfully');
      resolve(db);
    };

    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      
      // Relational tables
      database.createObjectStore('users', { keyPath: 'id' });
      database.createObjectStore('expenses', { keyPath: 'id', autoIncrement: true });
      database.createObjectStore('income', { keyPath: 'id', autoIncrement: true });
      database.createObjectStore('budgets', { keyPath: 'id' });
      database.createObjectStore('study_sessions', { keyPath: 'id', autoIncrement: true });
      database.createObjectStore('workout_sessions', { keyPath: 'id', autoIncrement: true });
      database.createObjectStore('college_attendance', { keyPath: 'id', autoIncrement: true });
      database.createObjectStore('meals', { keyPath: 'id', autoIncrement: true });
      database.createObjectStore('water_intake', { keyPath: 'id', autoIncrement: true });
      database.createObjectStore('sleep', { keyPath: 'id', autoIncrement: true });
      database.createObjectStore('habits', { keyPath: 'id', autoIncrement: true });
      database.createObjectStore('routine', { keyPath: 'id', autoIncrement: true });
      database.createObjectStore('goals', { keyPath: 'id', autoIncrement: true });
      database.createObjectStore('achievements', { keyPath: 'id', autoIncrement: true });
      database.createObjectStore('notifications', { keyPath: 'id', autoIncrement: true });
      database.createObjectStore('ai_commands', { keyPath: 'id', autoIncrement: true });
      database.createObjectStore('voice_history', { keyPath: 'id', autoIncrement: true });
      database.createObjectStore('calendar', { keyPath: 'id', autoIncrement: true });
      database.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
      database.createObjectStore('settings', { keyPath: 'key' });
      database.createObjectStore('backups', { keyPath: 'id', autoIncrement: true });
      database.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
      
      console.log('Database stores created successfully');
    };
  });
}

// Seed Initial Data Helper
async function seedInitialData() {
  const users = await dbGetAll('users');
  if (users.length === 0) {
    // Seed default user config (Clean profile)
    await dbPut('users', { id: 'current_user', name: 'Guest', currency: '₹', avatar: '' });
    
    // Seed default settings
    await dbPut('settings', { key: 'sound', value: true });
    await dbPut('settings', { key: 'haptics', value: true });
    await dbPut('settings', { key: 'theme', value: 'dark-violet' });
    await dbPut('settings', { key: 'voiceName', value: '' });
    
    // Seed budgets
    await dbPut('budgets', { id: 'monthly', limit: 10000, current: 0 });

    // Seed default notifications
    await dbAdd('notifications', { title: 'Welcome to LifeSync 2.0', message: 'Your personal companion is configured and ready.', type: 'info', timestamp: new Date().toISOString() });
  }
}

// Database Helpers
function dbGetStore(storeName, mode = 'readonly') {
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

function dbAdd(storeName, value) {
  return new Promise((resolve, reject) => {
    const store = dbGetStore(storeName, 'readwrite');
    const req = store.add(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbPut(storeName, value) {
  return new Promise((resolve, reject) => {
    const store = dbGetStore(storeName, 'readwrite');
    const req = store.put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbGet(storeName, key) {
  return new Promise((resolve, reject) => {
    const store = dbGetStore(storeName, 'readonly');
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbDelete(storeName, key) {
  return new Promise((resolve, reject) => {
    const store = dbGetStore(storeName, 'readwrite');
    const req = store.delete(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbGetAll(storeName) {
  return new Promise((resolve, reject) => {
    const store = dbGetStore(storeName, 'readonly');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ==========================================
   APPLICATION SERVICES LAYER
   ========================================== */

const ExpenseService = {
  async addExpense(amount, category, description, paymentMethod = 'Cash') {
    if (isNaN(amount) || amount <= 0) throw new Error('Invalid expense amount');
    const expense = {
      amount: parseFloat(amount),
      category: category.toLowerCase(),
      description: description || (category.charAt(0).toUpperCase() + category.slice(1)),
      paymentMethod,
      timestamp: new Date().toISOString()
    };
    
    // Add to Database
    const id = await dbAdd('expenses', expense);
    
    // Update monthly budget cache
    const budget = await dbGet('budgets', 'monthly');
    if (budget) {
      budget.current += expense.amount;
      await dbPut('budgets', budget);
    }
    
    // Log sync item
    await dbAdd('sync_queue', { operationType: 'ADD', table: 'expenses', payload: expense });
    
    // Trigger reactive updates
    document.dispatchEvent(new Event('db-update'));
    return id;
  },

  async deleteExpense(id) {
    const expense = await dbGet('expenses', id);
    if (!expense) return;
    
    await dbDelete('expenses', id);
    
    const budget = await dbGet('budgets', 'monthly');
    if (budget) {
      budget.current = Math.max(0, budget.current - expense.amount);
      await dbPut('budgets', budget);
    }
    
    await dbAdd('sync_queue', { operationType: 'DELETE', table: 'expenses', payload: { id } });
    document.dispatchEvent(new Event('db-update'));
  },

  async addIncome(amount, category, description) {
    if (isNaN(amount) || amount <= 0) throw new Error('Invalid income amount');
    const income = {
      amount: parseFloat(amount),
      category: category.toLowerCase(),
      description: description || 'Salary Credit',
      timestamp: new Date().toISOString()
    };
    
    const id = await dbAdd('income', income);
    await dbAdd('sync_queue', { operationType: 'ADD', table: 'income', payload: income });
    document.dispatchEvent(new Event('db-update'));
    return id;
  },

  async getRecentExpenses(limit = 10) {
    const expenses = await dbGetAll('expenses');
    return expenses.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
  },

  async getMonthlySummary() {
    const expenses = await dbGetAll('expenses');
    const income = await dbGetAll('income');
    const budget = await dbGet('budgets', 'monthly');
    
    const now = new Date();
    const currentMonthExpenses = expenses.filter(e => {
      const d = new Date(e.timestamp);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const currentMonthIncome = income.filter(i => {
      const d = new Date(i.timestamp);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    
    const expenseTotal = currentMonthExpenses.reduce((sum, item) => sum + item.amount, 0);
    const incomeTotal = currentMonthIncome.reduce((sum, item) => sum + item.amount, 0);
    const budgetLimit = budget ? budget.limit : 8000;
    
    return {
      expenseTotal,
      incomeTotal,
      savings: Math.max(0, incomeTotal - expenseTotal),
      budgetLimit,
      budgetRemaining: Math.max(0, budgetLimit - expenseTotal)
    };
  }
};

const RoutineService = {
  async addRoutineTask(title, time, category = 'Health') {
    const task = { title, completed: false, time, category };
    const id = await dbAdd('routine', task);
    document.dispatchEvent(new Event('db-update'));
    return id;
  },

  async toggleRoutineTask(id) {
    const task = await dbGet('routine', id);
    if (!task) return;
    
    task.completed = !task.completed;
    await dbPut('routine', task);
    
    // Sound synthesis & haptics check
    if (task.completed) {
      playSoundSynth(880, 0.1); // High chime sound
      triggerHaptics(30);       // Soft click haptic
      triggerConfettiExplosion();
    } else {
      playSoundSynth(440, 0.08); // Lower release sound
      triggerHaptics(15);
    }
    
    document.dispatchEvent(new Event('db-update'));
  },

  async getRoutineProgress() {
    const routines = await dbGetAll('routine');
    if (routines.length === 0) return 0;
    const completedCount = routines.filter(r => r.completed).length;
    return Math.round((completedCount / routines.length) * 100);
  },

  async addStudySession(subject, durationHours) {
    const session = { subject, duration: parseFloat(durationHours), timestamp: new Date().toISOString() };
    await dbAdd('study_sessions', session);
    document.dispatchEvent(new Event('db-update'));
  },

  async addWorkoutSession(workoutType, durationHours) {
    const session = { workoutType, duration: parseFloat(durationHours), timestamp: new Date().toISOString() };
    await dbAdd('workout_sessions', session);
    
    // Increment habit streaks if relevant
    const habits = await dbGetAll('habits');
    const workoutHabit = habits.find(h => h.name.toLowerCase().includes('workout') || h.name.toLowerCase().includes('gym'));
    if (workoutHabit) {
      workoutHabit.streak += 1;
      workoutHabit.history.push(1);
      await dbPut('habits', workoutHabit);
    }
    document.dispatchEvent(new Event('db-update'));
  }
};

const SystemService = {
  async saveAICommand(command, intent) {
    const cmd = { commandText: command, parsedIntent: intent, timestamp: new Date().toISOString() };
    await dbAdd('ai_commands', cmd);
  },

  async saveVoiceHistory(transcription) {
    const history = { transcriptionText: transcription, timestamp: new Date().toISOString() };
    await dbAdd('voice_history', history);
  },

  async getSettings() {
    const sound = await dbGet('settings', 'sound');
    const haptics = await dbGet('settings', 'haptics');
    const darkMode = await dbGet('settings', 'dark_mode');
    return {
      sound: sound ? sound.value : true,
      haptics: haptics ? haptics.value : true,
      darkMode: darkMode ? darkMode.value : true
    };
  },

  async setSetting(key, value) {
    await dbPut('settings', { key, value });
  },

  async addNotification(title, message, type = 'info') {
    const notification = { title, message, type, timestamp: new Date().toISOString() };
    await dbAdd('notifications', notification);
    showToast(title, message, type);
  },

  async resetDatabase() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase('LifeSyncDB');
      req.onsuccess = () => {
        console.log('Database deleted successfully');
        localStorage.clear();
        location.reload();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }
};

const AnalyticsService = {
  async getWeeklyRoutineStats() {
    // Generate mock stats based on database routines
    const routines = await dbGetAll('routine');
    const completedRatio = routines.length > 0 ? (routines.filter(r => r.completed).length / routines.length) : 0.8;
    
    // return values for 7 days
    return [
      { day: 'M', value: completedRatio * 0.9 },
      { day: 'T', value: completedRatio },
      { day: 'W', value: completedRatio * 0.7 },
      { day: 'T', value: completedRatio * 0.85 },
      { day: 'F', value: completedRatio * 0.92 },
      { day: 'S', value: completedRatio * 0.5 },
      { day: 'S', value: completedRatio * 0.6 }
    ];
  },

  async getCategoryAllocations() {
    const expenses = await dbGetAll('expenses');
    const totals = {};
    let grandTotal = 0;
    
    // Initialize defaults
    EXPENSE_CATEGORIES.forEach(c => totals[c.id] = 0);
    
    expenses.forEach(e => {
      const cat = e.category;
      if (totals[cat] !== undefined) {
        totals[cat] += e.amount;
      } else {
        totals['others'] = (totals['others'] || 0) + e.amount;
      }
      grandTotal += e.amount;
    });

    if (grandTotal === 0) {
      return [
        { category: 'food', name: 'Food', percentage: 50, color: '#7C3AED' },
        { category: 'shop', name: 'Shopping', percentage: 30, color: '#F59E0B' },
        { category: 'travel', name: 'Travel', percentage: 20, color: '#22C55E' }
      ];
    }

    return Object.keys(totals)
      .map(k => {
        const catObj = EXPENSE_CATEGORIES.find(c => c.id === k);
        return {
          category: k,
          name: catObj ? catObj.name : 'Others',
          percentage: Math.round((totals[k] / grandTotal) * 100),
          color: catObj ? catObj.color : '#6B7280'
        };
      })
      .filter(item => item.percentage > 0)
      .sort((a, b) => b.percentage - a.percentage);
  }
};

/* ==========================================
   AI ENGINE & NLP INTENT PARSER
   ========================================== */
const AIQueryEngine = {
  async parseAndExecute(input) {
    const cleaned = input.toLowerCase().trim();
    console.log(`AI Engine Processing: "${cleaned}"`);
    
    // Save AI command log
    await SystemService.saveAICommand(input, 'detecting');

    // Intent 1: Add Expense
    // e.g., "spent 250 on food", "spent 120 rupees on lunch", "uber ride 350"
    if (cleaned.includes('spent') || cleaned.includes('buy') || cleaned.includes('bought') || cleaned.includes('pay') || cleaned.includes('paid')) {
      const numbers = cleaned.match(/\d+(\.\d+)?/g);
      if (numbers) {
        const amount = parseFloat(numbers[0]);
        let category = 'others';
        let description = '';
        
        // Simple mapping rules
        if (cleaned.includes('coffee') || cleaned.includes('food') || cleaned.includes('lunch') || cleaned.includes('dinner') || cleaned.includes('restaurant') || cleaned.includes('pizza')) {
          category = 'food';
        } else if (cleaned.includes('shirt') || cleaned.includes('clothes') || cleaned.includes('store') || cleaned.includes('mall') || cleaned.includes('shop') || cleaned.includes('amazon')) {
          category = 'shop';
        } else if (cleaned.includes('uber') || cleaned.includes('cab') || cleaned.includes('travel') || cleaned.includes('taxi') || cleaned.includes('bus') || cleaned.includes('flight')) {
          category = 'travel';
        } else if (cleaned.includes('bill') || cleaned.includes('rent') || cleaned.includes('electricity') || cleaned.includes('wifi') || cleaned.includes('recharge')) {
          category = 'bills';
        } else if (cleaned.includes('gym') || cleaned.includes('medicine') || cleaned.includes('doctor') || cleaned.includes('health') || cleaned.includes('pill')) {
          category = 'health';
        } else if (cleaned.includes('movie') || cleaned.includes('netflix') || cleaned.includes('party') || cleaned.includes('bar') || cleaned.includes('fun')) {
          category = 'fun';
        } else if (cleaned.includes('friend') || cleaned.includes('lend') || cleaned.includes('party')) {
          category = 'friends';
        }
        
        // Extract description
        const words = input.split(' ');
        const onIndex = words.findIndex(w => w.toLowerCase() === 'on' || w.toLowerCase() === 'for');
        if (onIndex !== -1 && onIndex + 1 < words.length) {
          description = words.slice(onIndex + 1).join(' ');
        } else {
          // Fallback to what was after the number
          const matchAfter = input.match(/\d+\s+rupees?\s+on\s+(.+)/i) || input.match(/\d+\s+on\s+(.+)/i) || input.match(/\d+\s+(.+)/i);
          description = matchAfter ? matchAfter[1] : category;
        }

        // Execute Transaction through Service
        await ExpenseService.addExpense(amount, category, description);
        const reply = `Logged expense of ₹${amount} under ${category.toUpperCase()} for "${description}".`;
        speakText(reply);
        await SystemService.addNotification('Expense Logged', `₹${amount} added to ${category}`, 'success');
        return reply;
      }
    }

    // Intent 2: Record Income
    // e.g., "earned 25000", "received salary 50000"
    if (cleaned.includes('earned') || cleaned.includes('receive') || cleaned.includes('received') || cleaned.includes('income') || cleaned.includes('salary')) {
      const numbers = cleaned.match(/\d+(\.\d+)?/g);
      if (numbers) {
        const amount = parseFloat(numbers[0]);
        let category = 'salary';
        if (cleaned.includes('freelance') || cleaned.includes('gig')) category = 'freelance';
        if (cleaned.includes('business')) category = 'business';
        if (cleaned.includes('gift')) category = 'gift';

        await ExpenseService.addIncome(amount, category, 'Income Logged via Voice');
        const reply = `Income of ₹${amount} saved under category ${category}.`;
        speakText(reply);
        await SystemService.addNotification('Income Logged', `₹${amount} added to Income`, 'success');
        return reply;
      }
    }

    // Intent 3: Routine / Study Session
    // e.g., "studied java for 2 hours", "studied history for 1 hour"
    if (cleaned.includes('studied') || cleaned.includes('study')) {
      const numbers = cleaned.match(/\d+(\.\d+)?/g);
      const hours = numbers ? parseFloat(numbers[0]) : 1;
      let subject = 'General';
      const studyMatch = cleaned.match(/(?:study|studied)\s+([a-zA-Z0-9]+)/i);
      if (studyMatch && studyMatch[1]) {
        subject = studyMatch[1];
      }
      
      await RoutineService.addStudySession(subject, hours);
      const reply = `Logged study session: ${hours} hours on "${subject}".`;
      speakText(reply);
      await SystemService.addNotification('Study Tracked', `${hours} hrs logged on ${subject}`, 'success');
      return reply;
    }

    // Intent 4: Routine / Workouts
    // e.g., "gym for 1 hour", "workout for 2 hours"
    if (cleaned.includes('gym') || cleaned.includes('workout') || cleaned.includes('ran') || cleaned.includes('running')) {
      const numbers = cleaned.match(/\d+(\.\d+)?/g);
      const hours = numbers ? parseFloat(numbers[0]) : 1;
      
      await RoutineService.addWorkoutSession('Gym/Running', hours);
      const reply = `Logged workout session of ${hours} hours. Streak updated!`;
      speakText(reply);
      await SystemService.addNotification('Workout Recorded', `${hours} hrs logged. Streak extended.`, 'success');
      return reply;
    }

    // Intent 5: Querying Database
    // e.g., "how much did i spend today?", "what is my remaining budget?", "how much did i spend on food?"
    if (cleaned.includes('how much') || cleaned.includes('what is') || cleaned.includes('show') || cleaned.includes('get')) {
      const summary = await ExpenseService.getMonthlySummary();
      const expenses = await dbGetAll('expenses');
      
      // "how much did i spend on food"
      if (cleaned.includes('food')) {
        const foodTotal = expenses
          .filter(e => e.category === 'food')
          .reduce((sum, item) => sum + item.amount, 0);
        const reply = `You have spent a total of ₹${foodTotal.toFixed(2)} on Food.`;
        speakText(reply);
        return reply;
      }
      
      // "how much did i spend today"
      if (cleaned.includes('today')) {
        const todayStr = new Date().toDateString();
        const todayTotal = expenses
          .filter(e => new Date(e.timestamp).toDateString() === todayStr)
          .reduce((sum, item) => sum + item.amount, 0);
        const reply = `You spent ₹${todayTotal.toFixed(2)} today.`;
        speakText(reply);
        return reply;
      }

      // "remaining budget" or "budget status"
      if (cleaned.includes('budget')) {
        const reply = `Your remaining monthly budget is ₹${summary.budgetRemaining.toFixed(2)} out of ₹${summary.budgetLimit}.`;
        speakText(reply);
        return reply;
      }

      // Default monthly spend
      const reply = `You spent ₹${summary.expenseTotal.toFixed(2)} this month, with ₹${summary.budgetRemaining.toFixed(2)} remaining budget.`;
      speakText(reply);
      return reply;
    }

    // Intent 6: Querying Routine Status
    // e.g. "did i complete today's routine?", "routine progress"
    if (cleaned.includes('routine') || cleaned.includes('task') || cleaned.includes('checklist')) {
      const progress = await RoutineService.getRoutineProgress();
      const reply = `Your routine progress is at ${progress}%. You have done great today!`;
      speakText(reply);
      return reply;
    }

    // Default Fallback
    const fallback = "I could not find exact records matching that command. Please verify your query format.";
    speakText(fallback);
    return fallback;
  }
};

/* ==========================================
   SPEECH RECOGNITION & SYNTHESIS ENGINES
   ========================================== */
function initSpeechEngine() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('Web Speech API is not supported in this browser.');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isListening = true;
    updateMicUI(true);
  };

  recognition.onerror = (e) => {
    console.error('Speech recognition error:', e.error);
    isListening = false;
    updateMicUI(false);
    showToast('Voice Error', 'Speech recognition failed.', 'error');
  };

  recognition.onend = () => {
    isListening = false;
    updateMicUI(false);
  };

  recognition.onresult = async (e) => {
    const transcript = e.results[0][0].transcript;
    document.getElementById('ai-text-input').value = transcript;
    
    // Log voice history
    await SystemService.saveVoiceHistory(transcript);
    
    // Add command to log UI
    addHistoryItemToUI(transcript, '...');
    
    // Execute command
    const response = await AIQueryEngine.parseAndExecute(transcript);
    
    // Update the UI history log with the response
    updateLastHistoryItem(response);
  };
}

function startListening() {
  if (!recognition) {
    showToast('Speech API Error', 'Speech recognition not supported in this browser.', 'error');
    return;
  }
  if (isListening) {
    recognition.stop();
  } else {
    initAudioContext();
    recognition.start();
  }
}

function speakText(text) {
  // Check settings if sound is enabled
  SystemService.getSettings().then(settings => {
    if (!settings.sound) return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const selectedVoiceName = settings.voiceName || '';
    const voice = voices.find(v => v.name === selectedVoiceName);
    
    if (voice) {
      utterance.voice = voice;
    } else {
      // Find a premium flat english voice if possible
      const googleVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Microsoft David') || v.lang.startsWith('en'));
      if (googleVoice) utterance.voice = googleVoice;
    }
    
    utterance.rate = 1.05; // Slightly faster for a crisp premium feel
    utterance.pitch = 0.95; // Slightly lower pitch for a calm OS aesthetic
    window.speechSynthesis.speak(utterance);
  });
}

// Web Audio API Synthesizer (UI sound generation)
function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playSoundSynth(frequency, duration) {
  initAudioContext();
  if (!audioContext || audioContext.state === 'suspended') return;
  
  SystemService.getSettings().then(settings => {
    if (!settings.sound) return;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, audioContext.currentTime);
    
    // Soft exponential decay
    gain.gain.setValueAtTime(0.12, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start();
    osc.stop(audioContext.currentTime + duration);
  });
}

// Native Device Haptic Vibration wrapper
function triggerHaptics(ms) {
  SystemService.getSettings().then(settings => {
    if (settings.haptics && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  });
}

/* ==========================================
   CONFETTI GENERATOR ENGINE
   ========================================== */
function initConfettiCanvas() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
  
  window.addEventListener('resize', () => {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
  });
}

function triggerConfettiExplosion() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const count = 50;
  
  // Center of canvas explosion
  const startX = canvas.width / 2;
  const startY = canvas.height / 2;

  for (let i = 0; i < count; i++) {
    confettiParticles.push({
      x: startX,
      y: startY,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.7) * 12 - 4,
      color: `hsl(${Math.random() * 360}, 75%, 60%)`,
      size: Math.random() * 6 + 4,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      opacity: 1
    });
  }

  if (!confettiAnimationId) {
    animateConfetti(ctx, canvas);
  }
}

function animateConfetti(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  for (let i = confettiParticles.length - 1; i >= 0; i--) {
    const p = confettiParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.35; // Gravity
    p.rotation += p.rotationSpeed;
    p.opacity -= 0.015;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate((p.rotation * Math.PI) / 180);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.opacity;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    ctx.restore();

    if (p.y > canvas.height || p.opacity <= 0) {
      confettiParticles.splice(i, 1);
    }
  }

  if (confettiParticles.length > 0) {
    confettiAnimationId = requestAnimationFrame(() => animateConfetti(ctx, canvas));
  } else {
    confettiAnimationId = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

/* ==========================================
   UI BINDING, RENDERING & INTERACTIVE CHARTS
   ========================================== */

// Toast notification display
function showToast(title, message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast-card';
  
  let icon = 'info';
  let iconClass = '';
  if (type === 'success') {
    icon = 'check_circle';
    iconClass = 'success';
  } else if (type === 'error') {
    icon = 'warning';
    iconClass = 'error';
  }

  toast.innerHTML = `
    <div class="toast-left">
      <div class="toast-icon ${iconClass}">
        <span class="material-symbols-outlined">${icon}</span>
      </div>
      <div class="toast-details">
        <h4>${title}</h4>
        <p>${message}</p>
      </div>
    </div>
  `;

  container.appendChild(toast);
  
  // Animate Entrance
  setTimeout(() => toast.classList.add('show'), 50);
  
  // Auto Dismiss
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// Mic button animations
function updateMicUI(listening) {
  const micBtn = document.getElementById('mic-button');
  const statusText = document.getElementById('mic-status');
  const waveformBars = document.querySelectorAll('.waveform-bar');
  
  if (listening) {
    micBtn.classList.add('listening');
    statusText.innerText = 'LISTENING...';
    waveformBars.forEach(bar => {
      bar.classList.add('listening');
      // random speed delay
      bar.style.animationDelay = `${Math.random() * 0.4}s`;
    });
  } else {
    micBtn.classList.remove('listening');
    statusText.innerText = 'TAP TO VOICE';
    waveformBars.forEach(bar => {
      bar.classList.remove('listening');
      bar.style.height = '4px';
    });
  }
}

// AI Panel Command Log Lists
function addHistoryItemToUI(command, response) {
  const scroller = document.getElementById('ai-history-log');
  if (!scroller) return;

  const item = document.createElement('div');
  item.className = 'history-item';
  item.id = 'last-history-item';
  
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  item.innerHTML = `
    <div class="history-command">“ ${command} ”</div>
    <div class="history-response">${response}</div>
    <div class="history-time">${time}</div>
  `;

  // Remove previous ID mark
  const prevLast = document.getElementById('last-history-item');
  if (prevLast) prevLast.removeAttribute('id');

  scroller.prepend(item);
}

function updateLastHistoryItem(response) {
  const lastItem = document.getElementById('last-history-item');
  if (lastItem) {
    lastItem.querySelector('.history-response').innerText = response;
  }
}

// SVG Charts rendering engine
function renderDashboardProgressRing(percentage) {
  const circle = document.getElementById('dash-progress-ring');
  const text = document.getElementById('dash-progress-text');
  if (!circle) return;

  // Circumference of radius 70 is 439.8
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  
  circle.style.strokeDasharray = `${circumference} ${circumference}`;
  circle.style.strokeDashoffset = offset;
  text.innerText = `${percentage}%`;
}

function renderAnalyticsCharts() {
  renderSpendingLineChart();
  renderAllocationsPie();
  renderRoutineBarChart();
}

async function renderSpendingLineChart() {
  const expenses = await dbGetAll('expenses');
  const chartPath = document.getElementById('chart-line-path');
  if (!chartPath) return;

  // Group by day of month (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toDateString();
  });

  const totals = last7Days.map(dateStr => {
    return expenses
      .filter(e => new Date(e.timestamp).toDateString() === dateStr)
      .reduce((sum, item) => sum + item.amount, 0);
  });

  const maxVal = Math.max(...totals, 50); // Minimum scale floor
  
  // Calculate coordinates on 400x100 box
  const coords = totals.map((val, idx) => {
    const x = (idx / 6) * 400;
    const y = 85 - (val / maxVal) * 75; // Leave margins at top/bottom
    return { x, y };
  });

  // Build SVG Path string
  let pathD = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 1; i < coords.length; i++) {
    // Quadratic curves for Apple smooth lines
    const prev = coords[i - 1];
    const curr = coords[i];
    const cx = (prev.x + curr.x) / 2;
    pathD += ` Q ${prev.x} ${prev.y} ${cx} ${(prev.y + curr.y) / 2} T ${curr.x} ${curr.y}`;
  }

  chartPath.setAttribute('d', pathD);
  
  // Animate path draw
  chartPath.style.strokeDasharray = '1000';
  chartPath.style.strokeDashoffset = '1000';
  chartPath.getBoundingClientRect(); // trigger reflow
  chartPath.style.strokeDashoffset = '0';

  // Fill gradient
  const fillPath = document.getElementById('chart-line-fill');
  if (fillPath) {
    const fillD = `${pathD} V 100 H 0 Z`;
    fillPath.setAttribute('d', fillD);
  }
}

async function renderAllocationsPie() {
  const allocations = await AnalyticsService.getCategoryAllocations();
  const circle = document.getElementById('insights-pie-circle');
  const details = document.getElementById('insights-pie-details');
  if (!circle || !details) return;

  // Map to circle segment (radius 15.915 gives circum of 100)
  let offset = 0;
  let circlesHtml = `<circle cx="18" cy="18" fill="transparent" r="15.915" stroke="rgba(255,255,255,0.05)" stroke-width="3"></circle>`;
  
  allocations.forEach(item => {
    circlesHtml += `
      <circle class="chart-path" cx="18" cy="18" fill="transparent" r="15.915" 
              stroke="${item.color}" stroke-dasharray="${item.percentage} ${100 - item.percentage}" 
              stroke-dashoffset="${-offset}" stroke-width="3"></circle>
    `;
    offset += item.percentage;
  });

  circle.innerHTML = circlesHtml;

  // Add detail rows
  details.innerHTML = allocations.map(item => `
    <div class="allocation-row">
      <div class="allocation-label">
        <div class="allocation-dot" style="background: ${item.color}"></div>
        <span>${item.name}</span>
      </div>
      <span class="allocation-val">${item.percentage}%</span>
    </div>
  `).join('');
}

async function renderRoutineBarChart() {
  const container = document.getElementById('insights-routine-bars');
  if (!container) return;

  const weeklyStats = await AnalyticsService.getWeeklyRoutineStats();
  
  container.innerHTML = weeklyStats.map((item, idx) => {
    const heightPercent = Math.round(item.value * 100);
    // Active highlight on today's day (e.g. Wednesday -> match day index)
    const todayDayIndex = (new Date().getDay() + 6) % 7; // Monday = 0
    const activeClass = idx === todayDayIndex ? 'active' : '';

    return `
      <div class="chart-bar-col">
        <div class="chart-bar-track">
          <div class="chart-bar-fill ${activeClass}" style="height: ${heightPercent}%; animation-delay: ${idx * 0.1}s"></div>
        </div>
        <span class="chart-bar-label">${item.day}</span>
      </div>
    `;
  }).join('');
}

// UI State Sync
async function refreshUI() {
  console.log('Refreshing LifeSync Dashboard & Views...');

  // Set Profile details
  const profile = await dbGet('users', 'current_user');
  const initials = profile && profile.name ? profile.name.charAt(0).toUpperCase() : 'U';
  document.querySelectorAll('.profile-avatar-initials').forEach(el => el.innerText = initials);
  
  if (profile) {
    document.querySelectorAll('.profile-name-text').forEach(el => el.innerText = profile.name);
    
    if (profile.avatar) {
      document.querySelectorAll('.profile-avatar-img').forEach(el => {
        el.src = profile.avatar;
        el.classList.remove('hidden');
      });
      document.querySelectorAll('.profile-avatar-initials').forEach(el => el.classList.add('hidden'));
    } else {
      document.querySelectorAll('.profile-avatar-img').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('.profile-avatar-initials').forEach(el => el.classList.remove('hidden'));
    }
  }

  // Monthly Overview calculations
  const summary = await ExpenseService.getMonthlySummary();
  const currencySymbol = profile ? profile.currency : '₹';
  
  // Dashboard budget UI
  const budgetFill = document.getElementById('dash-budget-fill');
  const budgetPercentVal = document.getElementById('dash-budget-percent');
  const budgetTotalVal = document.getElementById('dash-budget-total');
  
  if (budgetFill) {
    const pct = summary.budgetLimit > 0 ? Math.min(100, Math.round((summary.expenseTotal / summary.budgetLimit) * 100)) : 0;
    budgetFill.style.width = `${pct}%`;
    budgetPercentVal.innerText = `${pct}% Spent`;
    budgetTotalVal.innerText = `${currencySymbol}${summary.expenseTotal.toFixed(0)} / ${currencySymbol}${summary.budgetLimit}`;
    
    // Add colored warnings based on thresholds
    budgetFill.className = 'progress-bar-fill';
    if (pct >= 90) budgetFill.classList.add('danger');
    else if (pct >= 70) budgetFill.classList.add('warning');
  }

  // Dashboard streak details
  const habits = await dbGetAll('habits');
  const routineProgress = await RoutineService.getRoutineProgress();
  
  // Progress Ring
  renderDashboardProgressRing(routineProgress);

  // Set streaks
  const streakDaysVal = document.getElementById('dash-streak-days');
  const streakNameVal = document.getElementById('dash-streak-name');
  if (habits.length > 0) {
    const mainHabit = habits[0];
    if (streakDaysVal) streakDaysVal.innerText = `${mainHabit.streak} Days`;
    if (streakNameVal) streakNameVal.innerText = mainHabit.name;
  } else {
    if (streakDaysVal) streakDaysVal.innerText = `0 Days`;
    if (streakNameVal) streakNameVal.innerText = "No active habits";
  }

  // Load Recent Expenses
  const recentList = document.getElementById('dash-recent-expenses');
  if (recentList) {
    const recent = await ExpenseService.getRecentExpenses(3);
    if (recent.length === 0) {
      recentList.innerHTML = '<div class="text-on-surface-variant font-mono text-center text-xs opacity-50 py-4">No recent expenses logged</div>';
    } else {
      recentList.innerHTML = recent.map(item => {
        const catIcon = EXPENSE_CATEGORIES.find(c => c.id === item.category)?.icon || 'shopping_cart';
        const dateStr = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `
          <div class="list-item">
            <div class="list-item-left">
              <div class="list-item-icon">
                <span class="material-symbols-outlined">${catIcon}</span>
              </div>
              <div class="list-item-info">
                <h4>${item.description}</h4>
                <p>${item.category} • ${dateStr}</p>
              </div>
            </div>
            <div class="list-item-right">
              <div class="list-item-value expense">-${currencySymbol}${item.amount.toFixed(2)}</div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Expenses Tab list
  const expensesListContainer = document.getElementById('expenses-tab-list');
  if (expensesListContainer) {
    const allExpenses = await dbGetAll('expenses');
    const sorted = allExpenses.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    document.getElementById('exp-monthly-total').innerText = `${currencySymbol}${summary.expenseTotal.toFixed(2)}`;
    
    // Compute daily average
    const currentDay = new Date().getDate();
    const dailyAvg = summary.expenseTotal / currentDay;
    document.getElementById('exp-daily-average').innerText = `${currencySymbol}${dailyAvg.toFixed(2)}`;

    if (sorted.length === 0) {
      expensesListContainer.innerHTML = `
        <div class="glass-card text-center p-md">
          <span class="material-symbols-outlined text-accent text-3xl mb-2">account_balance_wallet</span>
          <h4 class="font-display font-semibold mb-1">No expenses yet</h4>
          <p class="text-xs text-on-surface-variant opacity-60">Log transactions via manual '+' or Voice commands</p>
        </div>
      `;
    } else {
      expensesListContainer.innerHTML = sorted.map(item => {
        const catIcon = EXPENSE_CATEGORIES.find(c => c.id === item.category)?.icon || 'shopping_cart';
        const date = new Date(item.timestamp);
        const formatTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const formatDate = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        
        return `
          <div class="list-item">
            <div class="list-item-left">
              <div class="list-item-icon">
                <span class="material-symbols-outlined">${catIcon}</span>
              </div>
              <div class="list-item-info">
                <h4>${item.description}</h4>
                <p>${formatDate}, ${formatTime} via ${item.paymentMethod}</p>
              </div>
            </div>
            <div class="list-item-right">
              <div class="list-item-value expense">-${currencySymbol}${item.amount.toFixed(2)}</div>
              <span class="material-symbols-outlined text-xs text-danger opacity-40 hover:opacity-100 cursor-pointer self-end mt-1" onclick="deleteExpenseItem(${item.id})">delete</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Routines Tab list
  const routineListContainer = document.getElementById('routine-tab-list');
  if (routineListContainer) {
    const routines = await dbGetAll('routine');
    
    // Update count title
    const completedCount = routines.filter(r => r.completed).length;
    document.getElementById('routine-completed-count').innerText = `${completedCount}/${routines.length} COMPLETED`;

    if (routines.length === 0) {
      routineListContainer.innerHTML = '<div class="text-on-surface-variant font-mono text-center text-xs opacity-50 py-4">No tasks configured</div>';
    } else {
      routineListContainer.innerHTML = routines.map(item => {
        const completedClass = item.completed ? 'completed' : '';
        const checkIcon = item.completed ? 'check' : '';
        
        return `
          <div class="task-item ${completedClass}" onclick="toggleTaskCompletion(${item.id})">
            <div class="flex items-center gap-sm">
              <div class="task-checkbox">
                <span class="material-symbols-outlined">${checkIcon}</span>
              </div>
              <div class="task-details">
                <h4>${item.title}</h4>
                <p>${item.time} • ${item.category}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-xs text-danger opacity-40 hover:opacity-100 cursor-pointer" onclick="event.stopPropagation(); deleteRoutineTaskItem(${item.id})">delete</span>
              <span class="material-symbols-outlined text-on-surface-variant opacity-40">drag_indicator</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Habits streak and heatmap renders
  const habitsListContainer = document.getElementById('habits-tab-list');
  if (habitsListContainer) {
    const list = await dbGetAll('habits');
    
    if (list.length === 0) {
      habitsListContainer.innerHTML = '<div class="text-on-surface-variant font-mono text-center text-xs opacity-50 py-4">No habits configured</div>';
    } else {
      habitsListContainer.innerHTML = list.map(item => {
        // Create heatmap cell blocks
        const cells = item.history.map(level => {
          let levelClass = '';
          if (level > 0) {
            const randLvl = Math.ceil(Math.random() * 4); // simulate densities
            levelClass = `level-${randLvl}`;
          }
          return `<div class="heatmap-cell ${levelClass}"></div>`;
        }).join('');

        return `
          <div class="glass-card heatmap-card">
            <div class="flex justify-between items-center">
              <div>
                <h4 class="font-display font-bold text-md">${item.name}</h4>
                <p class="text-xs text-on-surface-variant opacity-60">Personal Best: ${item.maxStreak} Days</p>
              </div>
              <div class="flex items-center gap-xs">
                <span class="font-display text-[22px] text-accent font-bold">${item.streak}</span>
                <span class="material-symbols-outlined text-accent animate-flame filled cursor-pointer" onclick="event.stopPropagation(); incrementHabitStreak(${item.id})" title="Click to increment streak!">local_fire_department</span>
                <span class="material-symbols-outlined text-xs text-danger opacity-40 hover:opacity-100 cursor-pointer ml-1" onclick="deleteHabitItem(${item.id})">delete</span>
              </div>
            </div>
            <div class="heatmap-grid mt-sm">
              ${cells}
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Refresh Analytics charts if view is insights
  if (currentView === 'insights') {
    renderAnalyticsCharts();
  }
}

// Window actions exported
window.deleteExpenseItem = async function(id) {
  if (confirm('Delete this expense?')) {
    playSoundSynth(600, 0.08);
    await ExpenseService.deleteExpense(id);
  }
};

window.toggleTaskCompletion = async function(id) {
  await RoutineService.toggleRoutineTask(id);
};

window.deleteRoutineTaskItem = async function(id) {
  if (confirm('Delete this routine task?')) {
    playSoundSynth(440, 0.08);
    await dbDelete('routine', id);
    document.dispatchEvent(new Event('db-update'));
  }
};

window.deleteHabitItem = async function(id) {
  if (confirm('Delete this habit?')) {
    playSoundSynth(440, 0.08);
    await dbDelete('habits', id);
    document.dispatchEvent(new Event('db-update'));
  }
};

window.incrementHabitStreak = async function(id) {
  const habit = await dbGet('habits', id);
  if (!habit) return;
  
  habit.streak += 1;
  habit.maxStreak = Math.max(habit.streak, habit.maxStreak);
  habit.history.push(1);
  if (habit.history.length > 28) habit.history.shift();
  
  await dbPut('habits', habit);
  playSoundSynth(880, 0.1);
  triggerHaptics(30);
  triggerConfettiExplosion();
  document.dispatchEvent(new Event('db-update'));
};

window.addNewRoutineTaskPrompt = async function() {
  const title = prompt("Enter new routine task name:");
  if (!title) return;
  const time = prompt("Enter target time/schedule (e.g. 07:00 AM, Daily):", "Daily");
  if (!time) return;
  
  await RoutineService.addRoutineTask(title, time);
  playSoundSynth(523, 0.1);
  await SystemService.addNotification('Routine Task Added', `"${title}" has been created.`, 'success');
};

window.addNewHabitPrompt = async function() {
  const name = prompt("Enter new habit name:");
  if (!name) return;
  
  const habit = {
    name,
    streak: 0,
    maxStreak: 0,
    history: Array(28).fill(0) // 28 heatmap cells
  };
  
  await dbAdd('habits', habit);
  playSoundSynth(523, 0.1);
  await SystemService.addNotification('Habit Added', `"${name}" has been created.`, 'success');
  document.dispatchEvent(new Event('db-update'));
};

/* ==========================================
   VIEW CONTROLLERS & TAB SWITCHING
   ========================================== */
function navigateToTab(tabId) {
  if (tabId === currentView) return;
  playSoundSynth(500, 0.05);

  const tabs = document.querySelectorAll('.nav-tab');
  const screens = document.querySelectorAll('.screen');
  const indicator = document.getElementById('nav-indicator');

  let activeIndex = 0;
  
  // Find index & update tabs class
  tabs.forEach((tab, index) => {
    if (tab.dataset.tab === tabId) {
      tab.classList.add('active');
      activeIndex = index;
    } else {
      tab.classList.remove('active');
    }
  });

  // Calculate indicator displacement (tabbar is 64px, has padding)
  const tabWidth = tabs[0].offsetWidth;
  indicator.style.left = `${12 + activeIndex * tabWidth}px`;
  indicator.style.width = `${tabWidth - 8}px`;

  // Sliding view logic
  screens.forEach(screen => {
    if (screen.id === `${tabId}-tab`) {
      screen.classList.remove('exit-left');
      screen.classList.add('active');
    } else {
      screen.classList.remove('active');
      if (screen.id === `${currentView}-tab`) {
        screen.classList.add('exit-left');
      }
    }
  });

  currentView = tabId;
  
  // Special action on enters
  if (tabId === 'insights') {
    setTimeout(renderAnalyticsCharts, 100);
  }
}

// Dynamic Bottom Sheet Expense Form Step Controller
let currentExpenseStep = 1;
function openAddExpenseSheet() {
  playSoundSynth(523.25, 0.08); // C5 chime
  document.getElementById('expense-overlay').classList.add('active');
  document.getElementById('expense-sheet').classList.add('active');
  setExpenseFormStep(1);
}

function closeAddExpenseSheet() {
  playSoundSynth(392, 0.08); // G4 soft chime
  document.getElementById('expense-overlay').classList.remove('active');
  document.getElementById('expense-sheet').classList.remove('active');
}

function setExpenseFormStep(step) {
  currentExpenseStep = step;
  
  // Hide all form steps, show active
  document.querySelectorAll('.form-step').forEach((el, idx) => {
    if (idx + 1 === step) {
      el.classList.add('active');
      const input = el.querySelector('input');
      if (input) setTimeout(() => input.focus(), 150);
    } else {
      el.classList.remove('active');
    }
  });
}

// Manual Form Submit
async function submitExpenseForm() {
  const amount = parseFloat(document.getElementById('form-amount').value);
  
  // Get active category chip
  const activeChip = document.querySelector('.category-chip.active');
  const category = activeChip ? activeChip.dataset.cat : 'others';
  
  const desc = document.getElementById('form-desc').value;
  const payMethod = document.getElementById('form-paymethod').value;

  if (isNaN(amount) || amount <= 0) {
    showToast('Invalid Amount', 'Please enter a valid expense figure.', 'error');
    return;
  }

  try {
    playSoundSynth(880, 0.15); // Successful high sound
    triggerHaptics(60);
    triggerConfettiExplosion();

    await ExpenseService.addExpense(amount, category, desc, payMethod);
    await SystemService.addNotification('Expense Saved', `₹${amount} added successfully`, 'success');
    closeAddExpenseSheet();
    
    // Reset Form fields
    document.getElementById('form-amount').value = '';
    document.getElementById('form-desc').value = '';
    setExpenseFormStep(1);
  } catch (err) {
    showToast('Error saving', err.message, 'error');
  }
}

// AI Panel Overlay toggles
function toggleAssistantPanel() {
  const panel = document.getElementById('ai-panel');
  if (panel.classList.contains('active')) {
    panel.classList.remove('active');
  } else {
    panel.classList.add('active');
    playSoundSynth(587.33, 0.08); // D5 chime
  }
}

// Render local QR code for mobile testing
function generateLocalQRCode() {
  const canvas = document.getElementById('qr-code-canvas');
  if (!canvas) return;

  // Read __LOCAL_IP__ defined by Vite config
  const localIP = typeof __LOCAL_IP__ !== 'undefined' ? __LOCAL_IP__ : 'localhost';
  const url = `http://${localIP}:5173`;

  // Draw network badge
  document.getElementById('network-url-badge').innerText = url;

  // Use QRCode library loaded from CDN in index.html
  if (typeof QRCode !== 'undefined') {
    QRCode.toCanvas(canvas, url, {
      margin: 1,
      scale: 4,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    }, function (err) {
      if (err) console.error('QR code generation error:', err);
      else console.log('Showcase local IP QR code generated.');
    });
  }
}

// Apply theme overrides dynamically
function applyTheme(theme) {
  document.body.className = ''; // Reset all classes
  if (theme && theme !== 'dark-violet') {
    document.body.classList.add(`theme-${theme}`);
  }
}

// Populate available voice synthesis voices
function populateVoices() {
  const voiceSelect = document.getElementById('setting-voice');
  if (!voiceSelect) return;

  const voices = window.speechSynthesis.getVoices();
  
  SystemService.getSettings().then(settings => {
    const selectedVoiceName = settings.voiceName || '';
    
    voiceSelect.innerHTML = '<option value="">Default OS Voice</option>' + 
      voices.map(v => {
        const selected = v.name === selectedVoiceName ? 'selected' : '';
        return `<option value="${v.name}" ${selected}>${v.name} (${v.lang})</option>`;
      }).join('');
  });
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = populateVoices;
}

/* ==========================================
   INITIALIZATION & EVENT REGISTRATION
   ========================================== */
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize IndexedDB
  await initDB();
  await seedInitialData();

  // Load local settings
  const settings = await SystemService.getSettings();
  document.getElementById('toggle-sound').checked = settings.sound;
  document.getElementById('toggle-haptics').checked = settings.haptics;
  
  // Set theme dropdown value & apply theme class
  document.getElementById('setting-theme').value = settings.theme || 'dark-violet';
  applyTheme(settings.theme || 'dark-violet');

  // Populate voice picker select
  setTimeout(populateVoices, 100);

  // Setup reactive refresh listener
  document.addEventListener('db-update', refreshUI);

  // Initial UI Render
  await refreshUI();
  
  // Render local network QR code
  generateLocalQRCode();
  
  // Initialize PWA elements
  initConfettiCanvas();
  initSpeechEngine();

  // Setup tab indicator width on start
  const firstTab = document.querySelector('.nav-tab');
  const indicator = document.getElementById('nav-indicator');
  if (firstTab && indicator) {
    indicator.style.width = `${firstTab.offsetWidth - 8}px`;
    indicator.style.left = `12px`;
  }

  // Register Tab Navigation click triggers
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => navigateToTab(tab.dataset.tab));
  });

  // Category chip picker bindings
  document.querySelectorAll('.category-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  // Sound toggle binding
  document.getElementById('toggle-sound').addEventListener('change', (e) => {
    SystemService.setSetting('sound', e.target.checked);
    playSoundSynth(500, 0.05);
  });

  // Haptics toggle binding
  document.getElementById('toggle-haptics').addEventListener('change', (e) => {
    SystemService.setSetting('haptics', e.target.checked);
    triggerHaptics(30);
  });

  // Theme select binding
  document.getElementById('setting-theme').addEventListener('change', async (e) => {
    const theme = e.target.value;
    await SystemService.setSetting('theme', theme);
    applyTheme(theme);
    playSoundSynth(650, 0.08);
  });

  // Voice select binding
  document.getElementById('setting-voice').addEventListener('change', async (e) => {
    const voiceName = e.target.value;
    await SystemService.setSetting('voiceName', voiceName);
    playSoundSynth(650, 0.08);
  });

  // Avatar Image uploader binding
  document.getElementById('avatar-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target.result;
      
      // Update user avatar record
      const profile = await dbGet('users', 'current_user') || { id: 'current_user', name: 'User' };
      profile.avatar = base64Data;
      await dbPut('users', profile);
      
      playSoundSynth(880, 0.1);
      await SystemService.addNotification('Avatar Updated', 'Your profile image was updated successfully.', 'success');
      document.dispatchEvent(new Event('db-update'));
    };
    reader.readAsDataURL(file);
  });

  // Event dispatchers for manual CRUD actions
  document.getElementById('fab-btn').addEventListener('click', openAddExpenseSheet);
  document.getElementById('header-mic-btn').addEventListener('click', toggleAssistantPanel);
  document.getElementById('close-sheet-btn').addEventListener('click', closeAddExpenseSheet);
  document.getElementById('expense-overlay').addEventListener('click', closeAddExpenseSheet);

  // Form Step Navigation click triggers
  document.getElementById('step1-next').addEventListener('click', () => setExpenseFormStep(2));
  document.getElementById('step2-next').addEventListener('click', () => setExpenseFormStep(3));
  document.getElementById('form-submit').addEventListener('click', submitExpenseForm);

  // AI Assistant Panel bindings
  document.getElementById('close-ai-btn').addEventListener('click', toggleAssistantPanel);
  document.getElementById('mic-button').addEventListener('click', startListening);
  
  // Ask anything text query trigger
  document.getElementById('ai-text-send').addEventListener('click', async () => {
    const input = document.getElementById('ai-text-input');
    const text = input.value.trim();
    if (!text) return;
    
    playSoundSynth(650, 0.05);
    input.value = '';
    
    addHistoryItemToUI(text, '...');
    const response = await AIQueryEngine.parseAndExecute(text);
    updateLastHistoryItem(response);
  });

  // Suggestion tags bindings
  document.querySelectorAll('.suggestion-tag').forEach(tag => {
    tag.addEventListener('click', async () => {
      const text = tag.innerText.replace(/[“”]/g, '');
      addHistoryItemToUI(text, '...');
      const response = await AIQueryEngine.parseAndExecute(text);
      updateLastHistoryItem(response);
    });
  });

  // Dynamic status elements
  document.querySelectorAll('.time-greeting').forEach(el => {
    const hours = new Date().getHours();
    let greet = 'Good Day';
    if (hours < 12) greet = 'Good Morning';
    else if (hours < 18) greet = 'Good Afternoon';
    else greet = 'Good Evening';
    el.innerText = greet;
  });

  document.querySelectorAll('.date-today').forEach(el => {
    el.innerText = new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  });

  // Reset database bind
  document.getElementById('btn-reset-db').addEventListener('click', async () => {
    if (confirm('Are you absolutely sure you want to reset the database? All records will be wiped.')) {
      await SystemService.resetDatabase();
    }
  });

  // Keyboard shortcut support (Escape closes overlays)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAddExpenseSheet();
      document.getElementById('ai-panel').classList.remove('active');
    }
  });
});
