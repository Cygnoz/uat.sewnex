pipeline {
    agent any

    environment {
        SERVER_USER = 'root'
        SERVER_IP = '147.93.29.97'
        GIT_REPO = 'https://github.com/Cygnoz/BillBizz.git'
    }

    stages {
        stage('Clone Repository') {
            steps {
                git branch: 'Accounts', url: "${GIT_REPO}"
            }
        }

        stage('Deploy to Server') {
            steps {
                script {
                    sshagent(['SERVER_SSH_KEY']) {
                        sh """
                        ssh -o StrictHostKeyChecking=no root@147.93.29.97 << 'EOF'
                            cd ~/BillBizz
                            git pull origin Accounts

                            # Stop and remove the old container if it exists
                            if docker ps -q -f name=account-container; then
                                docker stop account-container
                                docker rm account-container
                            fi

                            # Build and run the new container
                            docker build -t account-container -f Dockerfile .
                            docker run -d --name account-container -p 5001:5001 account-container
                        EOF
                        """
                    }
                }
            }
        }
    }
}
