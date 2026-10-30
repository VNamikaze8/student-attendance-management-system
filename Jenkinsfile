
pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Check Environment') {
            steps {
                bat 'node --version'
                bat 'npm --version'
            }
        }

        stage('Install Dependencies') {
            steps {
                bat 'npm ci'
            }
        }

        stage('Validate Code') {
            steps {
                bat 'node --check server.js'
                bat 'node --check database.js'
                bat 'node --check public/script.js'
            }
        }
    }

    post {
        success {
            echo 'Jenkins CI Pipeline completed successfully!'
        }

        failure {
            echo 'Jenkins CI Pipeline failed. Check Console Output.'
        }
    }
}
