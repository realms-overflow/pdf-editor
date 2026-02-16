#!/bin/bash

echo "🚀  Pushing PDF Editor to GitHub"
echo "================================"
echo "Remote: https://github.com/realms-overflow/pdf-editor.git"
echo ""
echo "Runn ing: git push -u origin main"
echo "(You may be asked for your GitHub username and password/token)"
echo ""

git push -u origin main

echo ""
if [ $? -eq 0 ]; then
  echo "✅ Success! Your code is live on GitHub."
else
  echo "❌ Push failed. Please check your credentials."
fi
