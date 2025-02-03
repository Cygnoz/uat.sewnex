pipeline {
    agent any

    environment {
        GIT_REPO = 'https://github.com/Cygnoz/BillBizz.git'  // GitHub repository URL
        GIT_BRANCH = 'Accounts'  // Branch to build
        CONTAINER_NAME = 'accounts-container'  // Name of the container
        SERVER_USER = 'root'  // Server SSH user
        SERVER_IP = '147.93.29.97'  // Server IP address
        DOCKER_PORT = '5001'  // Docker port for this service
    }

    stages {
        stage('Checkout Code') {
            steps {
                script {
                    // Checkout the code using GitHub credentials
                    git credentialsId: 'github-credentials', branch: "${GIT_BRANCH}", url: "${GIT_REPO}"
                }
            }
        }
        
        stage('Build Docker Image') {
            steps {
                script {
                    // Build the Docker image using the Dockerfile in the current directory
                    echo "Building Docker image..."
                    sh 'docker build -t ${CONTAINER_NAME} -f Dockerfile .'
                }
            }
        }

        stage('Deploy to Server') {
            steps {
                script {
                    // SSH into the server and deploy the container
                    echo "Deploying Docker container to server..."
                    sh """
                    ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} << 'EOF'
                        # Stop and remove the old container if it exists
                        if docker ps -q -f name=${CONTAINER_NAME}; then
                            echo "Stopping and removing old container..."
                            docker stop ${CONTAINER_NAME}
                            docker rm ${CONTAINER_NAME}
                        fi
                        
                        # Run the new container on the specified port
                        echo "Deploying the new container..."
                        docker run -d --name ${CONTAINER_NAME} -p ${DOCKER_PORT}:${DOCKER_PORT} ${CONTAINER_NAME}
                    EOF
                    """
                }
            }
        }
    }

    post {
        success {
            echo 'Deployment was successful!'
        }
        failure {
            echo 'Deployment failed.'
        }
    }
}
