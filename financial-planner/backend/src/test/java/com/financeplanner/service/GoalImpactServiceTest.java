package com.financeplanner.service;

import com.financeplanner.dto.GoalImpactResponse;
import com.financeplanner.dto.GoalSimulationRequest;
import com.financeplanner.entity.Goal;
import com.financeplanner.entity.IncomeSource;
import com.financeplanner.entity.RetirementPlan;
import com.financeplanner.entity.User;
import com.financeplanner.repository.GoalRepository;
import com.financeplanner.repository.IncomeSourceRepository;
import com.financeplanner.repository.RetirementPlanRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class GoalImpactServiceTest {

    @Mock
    private GoalRepository goalRepository;
    @Mock
    private IncomeSourceRepository incomeSourceRepository;
    @Mock
    private RetirementPlanRepository retirementPlanRepository;

    @InjectMocks
    private GoalImpactService goalImpactService;

    private User testUser;
    private List<Goal> testGoals;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId(1L);
        testUser.setManualTotalSavings(1000.0);

        testGoals = new ArrayList<>();
        Goal g1 = new Goal();
        g1.setId(100L);
        g1.setName("Car");
        g1.setCost(10000.0);
        g1.setMonthlyAllocation(300.0);
        g1.setTargetDate(LocalDate.now().plusMonths(34));
        g1.setPriority(Goal.Priority.LOW);

        Goal g2 = new Goal();
        g2.setId(101L);
        g2.setName("House");
        g2.setCost(50000.0);
        g2.setMonthlyAllocation(500.0);
        g2.setTargetDate(LocalDate.now().plusMonths(100));
        g2.setPriority(Goal.Priority.HIGH);

        testGoals.add(g1);
        testGoals.add(g2);
    }

    @Test
    void testFeasibleSimulation() {
        when(goalRepository.findByUser(testUser)).thenReturn(testGoals);
        when(incomeSourceRepository.findByUserId(testUser.getId())).thenReturn(new ArrayList<>());
        when(retirementPlanRepository.findByUserId(testUser.getId())).thenReturn(new ArrayList<>());

        GoalSimulationRequest request = new GoalSimulationRequest();
        request.setType(GoalSimulationRequest.SimulationType.NEW_GOAL);
        request.setName("Vacation");
        request.setCost(2000.0);
        request.setMonthlyAllocation(100.0);
        request.setTargetDate(LocalDate.now().plusMonths(20));
        request.setPriority(Goal.Priority.MEDIUM);

        GoalImpactResponse response = goalImpactService.simulate(testUser, request);

        assertTrue(response.getFeasible());
        assertTrue(response.getAffectedGoals().isEmpty()); // Total allocation: 300+500+100 = 900 <= 1000 savings
    }

    @Test
    void testInfeasibleSimulationDelaysLowPriorityFirst() {
        when(goalRepository.findByUser(testUser)).thenReturn(testGoals);
        when(incomeSourceRepository.findByUserId(testUser.getId())).thenReturn(new ArrayList<>());
        when(retirementPlanRepository.findByUserId(testUser.getId())).thenReturn(new ArrayList<>());

        GoalSimulationRequest request = new GoalSimulationRequest();
        request.setType(GoalSimulationRequest.SimulationType.NEW_GOAL);
        request.setName("Big Purchase");
        request.setCost(5000.0);
        request.setMonthlyAllocation(400.0); // 300+500+400 = 1200 > 1000, gap = 200
        request.setTargetDate(LocalDate.now().plusMonths(10));
        request.setPriority(Goal.Priority.HIGH);

        GoalImpactResponse response = goalImpactService.simulate(testUser, request);

        assertFalse(response.getFeasible());
        assertEquals(1, response.getAffectedGoals().size());
        
        // Low priority goal (Car) should be delayed
        assertEquals("Car", response.getAffectedGoals().get(0).getName());
    }
}
