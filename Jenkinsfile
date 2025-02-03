pipeline {
    agent any

    environment {
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

        stage('Cleanup Old Container') {
            steps {
                echo "Checking for existing container ${CONTAINER_NAME}..."
                sshagent(credentials: [SSH_KEY_CREDENTIALS_ID]) {
                    script {
                        sh '''
                            ssh -o StrictHostKeyChecking=no root@${SERVER_IP} << 'EOF'
                                # Find the previous container ID (if any)
                                container_id=$(docker ps -a -q -f name=${CONTAINER_NAME})
                                
                                # If a container ID exists, stop and remove it
                                if [ -n "$container_id" ]; then
                                    echo "Container ${CONTAINER_NAME} found with ID: $container_id. Stopping and removing..."
                                    docker stop $container_id
                                    docker rm $container_id
                                else
                                    echo "No existing container with the name ${CONTAINER_NAME} found. Skipping cleanup..."
                                fi
                            'EOF'
                        '''
                    }
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
                                # Run the new container
                                echo "Deploying new container..."
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
        }
        success {
            echo "Deployment completed successfully!"
        }
        failure {
            echo "Deployment failed. Please check the logs."
        }
    }
}
