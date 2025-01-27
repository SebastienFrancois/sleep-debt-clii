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

// Helper to read/write user data
function readData() {
 if(!fs.existsSync(DATA_FILE)) {
   return {profile: null, history: []};
 }

 return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
 fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Function to calculate ideal sleep time based on age
function calculateIdealSleep(age){
    if (age <= 12) return 10; // Children
    if (age <= 18) return 9;  // Teens
    if (age <= 64) return 8;  // Adults
    return 7;                 // Seniors
}

// Main CLI logic
async function main() {
    process.on('uncaughtException', (error) => {
        if (error instanceof Error && error.name === 'ExitPromptError') {
          console.log('👋 until next time!');
        } else {
          // Rethrow unknown errors
          throw error;
        }
      });
    

    const data = readData();
    if(!data.profile){
        console.log(chalk.blue('Welcome to Sleep Debt CLI ! Let’s create your sleep profile.'));
        const profile = await inquirer.prompt([
            { name: 'name', message: 'What is your name?', type: 'input' },
            { name: 'age', message: 'How old are you?', type: 'number' },
            {
                name: 'avgSleep',
                message: 'How many hours do you usually sleep per night?',
                type: 'number',
            },
            {
                name: 'wakeUpTime',
                message: 'What time do you want to wake up (e.g., 07:00)?',
                type: 'input',
            },
        ]);

        profile.idealSleep = calculateIdealSleep(profile.age);
        data.profile = profile;
        writeData(data);
        
        console.log(chalk.green('Profile created successfully!'));
    } else {
        console.log(chalk.green('Welcome back, ' + data.profile.name + '!'));
    }

    const { sleepHours, interruptions } = await inquirer.prompt([
        {
            name: 'sleepHours',
            message: 'How many hours did you sleep last night?',
            type: 'number',
        },
        {
            name: 'interruptions',
            message:
                'Did you experience any interruptions? If so, how long (in minutes)?',
            type: 'input',
            default: '0',
        },
    ]);

    const interruptionTime = interruptions
    .split(',')
    .map(Number)
    .reduce((a, b) => a + b, 0) / 60; // Convert to hours

    const totalSleep = sleepHours - interruptionTime;
    const sleepDebt = data.profile.idealSleep - totalSleep;

    data.history.push({
        date: new Date().toISOString().split('T')[0],
        totalSleep,
        sleepDebt,
    });
    writeData(data);

    if (sleepDebt > 0) {
        console.log(
            chalk.red(
                `You have a sleep debt of ${sleepDebt.toFixed(
                    2
                )} hours. Suggestions:`
            )
        );
        if (sleepDebt <= 1) {
            console.log(chalk.yellow(' - Take a short nap of 20-30 minutes.'));
        } else if (sleepDebt <= 3) {
            console.log(
                chalk.yellow(' - Try sleeping earlier tonight by an hour.')
            );
        } else {
            console.log(
                chalk.yellow(
                    ' - Plan to catch up on sleep over the next few days.'
                )
            );
        }
    } else {
        console.log(chalk.green('Congratulations! You have no sleep debt.'));
    }
}


main();