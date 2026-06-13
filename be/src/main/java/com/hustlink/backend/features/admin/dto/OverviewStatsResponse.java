package com.hustlink.backend.features.admin.dto;

public record OverviewStatsResponse(
                                    long usersCount,
                                    long postsCount,
                                    long jobsCount,
                                    long companiesCount,
                                    long eventsCount,
                                    long pendingCompaniesCount,
                                    long pendingReportsCount
) {
}
