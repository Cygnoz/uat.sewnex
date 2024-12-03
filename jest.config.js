module.exports = {
    testEnvironment: 'node',
    verbose: true,
    collectCoverage: true,
    coverageDirectory: 'coverage',
    transform: {
        '^.+\\.js$': 'babel-jest',
    },
};
