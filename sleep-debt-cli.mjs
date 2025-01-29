#!/usr/bin/env node 

import chalk from 'chalk';
import fs from 'fs';
import inquirer from 'inquirer';
import process from 'node:process';
import path from 'path';
import { fileURLToPath } from 'url';

// Recreate __dirname
const __filename = fileURLToPath(import.meta.url); // Current file path
const __dirname = path.dirname(__filename); // Current directory


// File to store user data
const DATA_FILE = path.join(__dirname, 'sleepData.json');

// SleepDataManager class to manage user data read/write operations
class SleepDataManager {
    constructor(dataFile) {
        this.dataFile = dataFile;
    }

    readData() {
        if(!fs.existsSync(DATA_FILE)) {
            return {profile: null, history: []};
          }
         
          return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }

    writeData(data) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    }
}

class UserProfile {
    constructor(name, age, avgSleep, wakeUpTime) {
        this.name = name;
        this.age = age;
        this.avgSleep = avgSleep;
        this.wakeUpTime = wakeUpTime;
        this.idealSleep = this.calculateIdealSleep();
    }

    calculateIdealSleep() {
        if (this.age <= 12) return 10; // Children
        if (this.age <= 18) return 9; // Teens
        if (this.age <= 64) return 8; // Adults
        return 7; // Seniors
    }
}

class SleepRecord {
    constructor(date, totalSleep, sleepDebt) {
        this.date = date;
        this.totalSleep = totalSleep;
        this.sleepDebt = sleepDebt;
    }
}

class SleepTracker {
    constructor(){
        this.dataManager = new SleepDataManager(DATA_FILE);
        this.data = this.dataManager.readData();
        this.profile = null;
        this.history = [];
        this.initializeFromData();
    }
    

    initializeFromData() {
        if(this.data.profile) {
            this.profile = new UserProfile(
                this.data.profile.name,
                this.data.profile.age,
                this.data.profile.avgSleep,
                this.data.profile.wakeUpTime
            );
            
            this.history = this.data.history.map((record) => new SleepRecord(record.date, record.totalSleep, record.sleepDebt));
        }
    }

    async start() {
        try {
          if (!this.profile) await this.createProfile();
          else console.log(chalk.green(`Welcome back, ${this.profile.name}!`));
    
          await this.handleNapAdjustment();
          const { sleepHours, interruptions } = await this.promptSleepInput();
          const totalSleep = this.calculateTotalSleep(sleepHours, interruptions);
          const sleepDebt = this.calculateSleepDebt(totalSleep);
    
          this.updateHistory(totalSleep, sleepDebt);
          this.displaySleepDebt(sleepDebt);
          this.persistData();
        } catch (error) {
          if (error.name !== 'ExitPromptError') throw error;
        }
    }

    async createProfile() {
        console.log(chalk.blue('Welcome to Sleep Debt CLI! Let’s create your sleep profile.'));
        const answers = await inquirer.prompt([
            { name: 'name', message: 'What is your name?', type: 'input' },
            { name: 'age', message: 'How old are you?', type: 'number' },
            {
            name: 'avgSleep',
            message: 'How many hours do you usually sleep per night? (e.g., 8, 6.5)',
            type: 'input',
            validate: (input) => this.validateHoursInput(input),
            },
            {
            name: 'wakeUpTime',
            message: 'What time do you want to wake up (e.g., 07:00)?',
            type: 'input',
            validate: (input) => /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(input),
            },
        ]);

        this.profile = new UserProfile(
            answers.name,
            answers.age,
            parseFloat(answers.avgSleep),
            answers.wakeUpTime
        );
        this.persistData();
        console.log(chalk.green('Profile created successfully!'));
    }

    validateHoursInput(input) {
        const value = parseFloat(input);
        return !isNaN(value) && value > 0 && value < 24;
    }

    async handleNapAdjustment() {
        const prevDebt = this.getPreviousSleepDebt();
        if (prevDebt <= 0) return;
    
        const { hasNapped } = await inquirer.prompt([
          {
            name: 'hasNapped',
            message: `You have a sleep debt of ${prevDebt.toFixed(2)} hours. Did you take any naps?`,
            type: 'confirm',
          },
        ]);
    
        if (hasNapped) {
          const { napMinutes } = await this.promptNapTime();
          this.adjustSleepDebt(napMinutes);
        }
    }

    async promptNapTime() {
        return inquirer.prompt([
          {
            name: 'napMinutes',
            message: 'How many minutes did you nap? (e.g., 20, 45)',
            type: 'input',
            validate: (input) => {
              const value = parseFloat(input);
              return !isNaN(value) && value >= 0;
            },
          },
        ]);
      }
    
    adjustSleepDebt(napMinutes) {
        const napHours = parseFloat(napMinutes) / 60;
        this.history[this.history.length - 1].sleepDebt -= napHours;
        console.log(chalk.green('Nap added successfully!'));
    }
    
    async promptSleepInput() {
        const answers = await inquirer.prompt([
          {
            name: 'sleepHours',
            message: 'How many hours did you sleep last night? (e.g., 8, 6.5)',
            type: 'input',
            validate: (input) => this.validateHoursInput(input),
          },
          {
            name: 'interruptions',
            message: 'Interruption duration in minutes? (0 if none)',
            type: 'input',
            default: '0',
            validate: (input) => {
              const value = parseFloat(input);
              return !isNaN(value) && value >= 0;
            },
          },
        ]);
    
        return {
          sleepHours: parseFloat(answers.sleepHours),
          interruptions: parseFloat(answers.interruptions),
        };
    }
    
    calculateTotalSleep(sleepHours, interruptions) {
        return sleepHours - (interruptions / 60);
    }

    calculateSleepDebt(totalSleep) {
        const prevDebt = this.getPreviousSleepDebt();
        return (this.profile.idealSleep - totalSleep) + prevDebt;
    }

    getPreviousSleepDebt() {
        return this.history.length > 0 
            ? this.history[this.history.length - 1].sleepDebt
            : 0;
    }

    updateHistory(totalSleep, sleepDebt) {
        this.history.push(new SleepRecord(
            new Date().toISOString().split('T')[0],
            totalSleep,
            sleepDebt
        ));
    }

    displaySleepDebt(sleepDebt) {
        if (sleepDebt > 0) {
            console.log(chalk.red(`Sleep debt: ${sleepDebt.toFixed(2)} hours. Suggestions:`));
            if (sleepDebt <= 1) console.log(chalk.yellow('- 20-30 minute nap'));
            else if (sleepDebt <= 3) console.log(chalk.yellow('- Sleep 1 hour earlier'));
            else console.log(chalk.yellow('- Plan multi-day catchup'));
        } else {
            console.log(chalk.green('No sleep debt! Keep it up!'));
        }
    }

    persistData() {
        this.dataManager.writeData({
            profile: {
                name: this.profile.name,
                age: this.profile.age,
                avgSleep: this.profile.avgSleep,
                wakeUpTime: this.profile.wakeUpTime,
                idealSleep: this.profile.idealSleep,
            },
            history: this.history.map(record => ({
                date: record.date,
                totalSleep: record.totalSleep,
                sleepDebt: record.sleepDebt,
            })),
        });
    }
}

// Execution
process.on('uncaughtException', (error) => {
    if (error.name === 'ExitPromptError') console.log('👋 Goodbye!');
    else throw error;
  });
  
// Start the SleepTracker
new SleepTracker().start();