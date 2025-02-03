pipeline {
    agent any

    environment {
        // Define your environment variables
        CONTAINER_NAME = 'accounts-container'
        DOCKER_PORT = '5001'
        SERVER_IP = '147.93.29.97'  // Update with your server IP
        SSH_KEY_CREDENTIALS_ID = 'd9e5f3c2-383d-4325-8dee-77763d2e4f3b'  // Your SSH credentials ID
    }

    stages {
        stage('Checkout SCM') {
            steps {
                echo "Checking out source code from GitHub..."
                git branch: 'Accounts', url: 'https://github.com/Cygnoz/BillBizz.git'
            }
        }

        stage('Build Docker Image') {
            steps {
                echo "Building Docker image..."
                script {
                    sh '''
                        docker build -t ${CONTAINER_NAME} -f Dockerfile .
                    '''
                }
            }
        }

        stage('Deploy to Server') {
            steps {
                echo "Deploying Docker container to server..."
                sshagent(credentials: [SSH_KEY_CREDENTIALS_ID]) {
                    script {
                        sh '''
                            ssh -o StrictHostKeyChecking=no root@${SERVER_IP} << 'EOF'
                                # Check if the container is running
                                if docker ps -q -f name=${CONTAINER_NAME}; then
                                    echo "Stopping and removing the old container..."
                                    docker stop ${CONTAINER_NAME}
                                    docker rm ${CONTAINER_NAME}
                                else
                                    echo "No running container found for ${CONTAINER_NAME}. Proceeding with deployment..."
                                fi

                                # Run the new container
                                echo "Running the new container..."
                                docker run -d --name ${CONTAINER_NAME} -p ${DOCKER_PORT}:${DOCKER_PORT} ${CONTAINER_NAME}:latest
                            EOF
                        '''
                    }
                }
            }
        }
    }

    post {
        always {
            echo "Cleaning up..."
            // Any cleanup tasks can go here
        }
        success {
            echo "Deployment completed successfully!"
        }
        failure {
            echo "Deployment failed. Please check the logs."
        }
    }
}
