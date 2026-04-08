#!/bin/bash

echo "Running tests with coverage..."

# Run main tests
echo "Running main library tests..."
bunx jest --coverage

# Run example tests
echo "Running example app tests..."
cd example
bunx jest --coverage --passWithNoTests
cd ..

echo "Coverage reports generated in ./coverage and ./example/coverage"
