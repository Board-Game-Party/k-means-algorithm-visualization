# K-means Clustering[cite: 1]

## Overview
* It is a partitional clustering approach.[cite: 1]
* Each cluster is associated with a centroid (center point).[cite: 1]
* Each point is assigned to the cluster with the closest centroid.[cite: 1]
* The number of clusters, K, must be specified.[cite: 1]
* The objective is to minimize the sum of distances of the points to their respective centroid.[cite: 1]

## Problem Definition
* Given a set X of n points in a d-dimensional space and an integer K, group the points into K clusters $C=\{C_{1},C_{2},...,C_{k}\}$.[cite: 1]
* The goal is to minimize $cost(C)=\sum_{i=1}^{k}\sum_{x\in C_{i}}dist(x,c)$.[cite: 1]
* $C_{i}$ is the centroid of the points in cluster $C_{i}$.[cite: 1]

## K-means Algorithm (Lloyd's algorithm)
1. **Initial:** Select K points as the initial centroids.[cite: 1]
2. **Repeat:** Form K clusters by assigning all points to the closest centroid.[cite: 1]
3. **Update:** Recompute the centroid of each cluster.[cite: 1]
4. **Until:** The centroids don't change.[cite: 1]

*Note:*
* Initial centroids are often chosen randomly.[cite: 1]
* Clusters produced vary from one run to another.[cite: 1]

## Example Steps (1 feature)
* **Round 0:** Initial random selection of centroids (e.g., A at 1 and B at 4).[cite: 1]
* **Round 1:** Assign points to the closest centroid and compute new centers (e.g., New center of A is 1.0, B is 6.3).[cite: 1]
* **Round 2:** Reassign points based on the new centroids and recompute (e.g., New center of A is 1.7, B is 8.0).[cite: 1]
* **Round 3:** Continue this process until the clusters and centroids no longer change.[cite: 1]

## Dealing with Initialization
* Do multiple runs and select the clustering with the smallest error.[cite: 1]
* Select original set of points by methods other than random. E.g., pick the most distant (from each other) points as cluster centers.[cite: 1]

## Limitations of K-means
* K-means has problems when clusters are of different sizes.[cite: 1]
* K-means has problems when clusters are of different densities.[cite: 1]
* K-means has problems when clusters are of non-globular shapes.[cite: 1]
* K-means has problems when the data contains outliers.[cite: 1]

### Overcoming Limitations
* One solution is to use many clusters.[cite: 1]
* Find parts of clusters, but need to put together.[cite: 1]

## Python Implementation Example
```python
from sklearn.cluster import KMeans
import numpy as np

X = np.array([[1, 2], [1, 4], [1, 0],
              [4, 2], [4, 4], [4, 0]])

kmeans = KMeans(n_clusters=2, random_state=0).fit(X)
kmeans.labels_ # array([0, 0, 0, 1, 1, 1], dtype=int32)
kmeans.predict([[0, 0], [4, 4]]) # array([0, 1], dtype=int32)
kmeans.cluster_centers_ 
# array([[ 1.,  2.],
#        [ 4.,  2.]])