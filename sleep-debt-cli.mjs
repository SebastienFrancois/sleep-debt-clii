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

// Custom validation function for inquirer prompt to check if the input is a valid float number
function validateFloat(input) {
    const hours = parseFloat(input);
    return !isNaN(hours) && hours > 0 && hours < 24;
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
                message: 'How many hours do you usually sleep per night? (e.g., 8, 6.5)',   
                type: 'input',
                validate: validateFloat,
            },
            {
                name: 'wakeUpTime',
                message: 'What time do you want to wake up (e.g., 07:00)?',
                type: 'input',
                validate: (input) => {
                    return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(input);
                }
            },
        ]);

        profile.idealSleep = calculateIdealSleep(profile.age);
        data.profile = profile;
        writeData(data);
        
        console.log(chalk.green('Profile created successfully!'));
    } else {
        console.log(chalk.green('Welcome back, ' + data.profile.name + '!'));
    }

    // Check if user has any sleep debt already and ask if he did any naps to reduce it ? Check last entry
    let prevSleepDebt  = data.history.length > 0 ? data.history[data.history.length - 1].sleepDebt : 0;

    if (prevSleepDebt > 0) {
        await inquirer.prompt([
            {
                name: 'hasNapped',
                message:   `You have a sleep debt of ${prevSleepDebt.toFixed(
                    2
                )} hours. Did you take any naps to reduce it?`,
                type: "confirm",
            },
        ]).then(async ({ hasNapped }) => {
            if (hasNapped) {
                const { napHours } = await inquirer.prompt([
                    {
                        name: 'napHours',
                        message: 'How many hours did you nap? (e.g., 1, 0.5)',
                        type: 'input',
                        validate: validateFloat,
                    },
                ]);
                prevSleepDebt = prevSleepDebt - parseFloat(napHours);
                console.log(chalk.green('Nap added successfully!'));
            }});
    }

    const { sleepHours, interruptions } = await inquirer.prompt([
        {
            name: 'sleepHours',
            message: 'How many hours did you sleep last night? (e.g., 8, 6.5)',
            type: 'input',
            validate: validateFloat,
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

    

    const totalSleep =  parseFloat(sleepHours) - interruptionTime;
    let sleepDebt = (data.profile.idealSleep - totalSleep);

    if(prevSleepDebt > 0) sleepDebt = sleepDebt + prevSleepDebt;
        

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