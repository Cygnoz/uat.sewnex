##############################pipeline {
    agent any
    environment {
        CONTAINER_NAME = '##accounts-container'
        SERVER_IP = '147.93.29.97'
        SSH_KEY_CREDENTIALS_ID = '###d9e5f3c2-383d-4325-8dee-77763d2e4f3b'
    }
    stages {
        stage('Checkout SCM') {
            steps {
                echo "Checking out code from SCM..."
                checkout scm
            }
        }
        
        stage('Build Docker Image') {
            steps {
                echo "Building Docker image..."
                script {
                    // Build your Docker image here
                    sh '''
                        docker build -t ${CONTAINER_NAME} .
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
                            ssh -o StrictHostKeyChecking=no root@${SERVER_IP} "
                                # Find the previous container ID (if any)
                                container_id=\$(docker ps -a -q -f name=${CONTAINER_NAME})

                                # If a container ID exists, stop and remove it
                                if [ -n "\$container_id" ]; then
                                    echo 'Container ${CONTAINER_NAME} found with ID: \$container_id. Stopping and removing...'
                                    docker stop \$container_id
                                    docker rm \$container_id
                                else
                                    echo 'No existing container with the name ${CONTAINER_NAME} found. Skipping cleanup...'
                                fi
                            "
                        '''
                    }
                }
            }
        }

        stage('Deploy to Server') {
            steps {
                echo "Deploying new container to the server..."
                sshagent(credentials: [SSH_KEY_CREDENTIALS_ID]) {
                    script {
                        sh '''
                            ssh -o StrictHostKeyChecking=no root@${SERVER_IP} "
                                # Run the new container
                                docker run -d --name ${CONTAINER_NAME} -p 5001:5001 ${CONTAINER_NAME}
                            "
                        '''
                    }
                }
            }
        }

        stage('Post Actions') {
            steps {
                echo "Cleaning up..."
                // Add any post deployment actions here
            }
        }
    }
}
