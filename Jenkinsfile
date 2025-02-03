pipeline {
    agent any

    environment {
        CONTAINER_NAME = 'accounts-container' // Name of the Docker container
        DOCKER_PORT = '5001' // Port to expose on the host
        SERVER_IP = '147.93.29.97' // IP address of the deployment server
        SSH_KEY_CREDENTIALS_ID = 'd9e5f3c2-383d-4325-8dee-77763d2e4f3b' // Jenkins credentials ID for SSH
    }

    stages {
        // Stage 1: Cleanup Old Container
        stage('Cleanup Old Container') {
            steps {
                echo "Checking for existing container ${CONTAINER_NAME}..."
                sshagent(credentials: [SSH_KEY_CREDENTIALS_ID]) {
                    script {
                        sh """
                            ssh -o StrictHostKeyChecking=no root@${SERVER_IP} << 'EOF'
                                # Check if the container exists and remove it
                                if docker ps -a -q -f name=${CONTAINER_NAME}; then
                                    echo "Container ${CONTAINER_NAME} found. Stopping and removing..."
                                    docker stop ${CONTAINER_NAME} || echo "Container already stopped"
                                    docker rm ${CONTAINER_NAME} || echo "Container already removed"
                                else
                                    echo "No existing container with the name ${CONTAINER_NAME} found. Skipping cleanup..."
                                fi
                            EOF
                        """
                    }
                }
            }
        }

        // Stage 2: Checkout Source Code from GitHub
        stage('Checkout SCM') {
            steps {
                echo "Checking out source code from GitHub..."
                git branch: 'Accounts', url: 'https://github.com/Cygnoz/BillBizz.git'
            }
        }

        // Stage 3: Build Docker Image
        stage('Build Docker Image') {
            steps {
                echo "Building Docker image..."
                script {
                    sh """
                        docker build -t ${CONTAINER_NAME} -f Dockerfile .
                    """
                }
            }
        }

        // Stage 4: Deploy to Server
        stage('Deploy to Server') {
            steps {
                echo "Deploying Docker container to server..."
                sshagent(credentials: [SSH_KEY_CREDENTIALS_ID]) {
                    script {
                        sh """
                            ssh -o StrictHostKeyChecking=no root@${SERVER_IP} << 'EOF'
                                # Run the new container
                                echo "Deploying new container..."
                                docker run -d --name ${CONTAINER_NAME} -p ${DOCKER_PORT}:${DOCKER_PORT} ${CONTAINER_NAME}:latest
                            EOF
                        """
                    }
                }
            }
        }
    }

    // Post-build actions
    post {
        always {
            echo "Cleaning up..."
        }
        success {
            echo "Deployment completed successfully!"
        }
        failure {
            echo "Deployment failed. Please check the logs."
        }
    }
}
